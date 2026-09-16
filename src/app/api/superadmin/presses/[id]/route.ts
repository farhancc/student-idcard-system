import { NextResponse } from 'next/server';
import { prisma, withSystemContext } from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';
import { getClientIp } from '@/lib/rate-limit';
import { requireSuperAdmin } from '@/lib/authz';
import { deleteManyFromR2 } from '@/lib/storage';

const isCloudinaryConfigured = 
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function getCloudinaryPublicId(url: string): string | null {
  if (!url || !url.includes('cloudinary.com')) return null;
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    const pathPart = parts[1];
    const pathSegments = pathPart.split('/');
    const startIndex = pathSegments[0].startsWith('v') && !isNaN(Number(pathSegments[0].substring(1))) ? 1 : 0;
    const relativePath = pathSegments.slice(startIndex).join('/');
    return relativePath.substring(0, relativePath.lastIndexOf('.'));
  } catch {
    return null;
  }
}

/**
 * DELETE /api/superadmin/presses/[id]
 * Hard deletes a press and ALL associated users, clients, cardholders, orders,
 * templates, portal shares, fonts, and their R2/Cloudinary media assets permanently.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if ('response' in auth) return auth.response;

  try {
    const { id } = await params;
    const pressId = Number(id);

    if (isNaN(pressId)) {
      return NextResponse.json({ error: 'Invalid Press ID' }, { status: 400 });
    }

    // Every model touched below (Cardholder, CardAsset, CardTemplate, PdfJob,
    // PressFont, ...) is tenant-scoped and this is a cross-tenant superadmin
    // action with no per-request press context, so it must run unscoped —
    // same as the cron cleanup and retention purge do.
    return await withSystemContext(async () => {
      const press = await prisma.press.findUnique({
        where: { id: pressId },
        select: { id: true, name: true, email: true },
      });

      if (!press) {
        return NextResponse.json({ error: 'Press not found' }, { status: 404 });
      }

      // 1. Collect every R2 object this press owns before anything is deleted —
      //    once the cascade below runs there is no DB row left to read a URL
      //    from. Mirrors the bulk retention purge's scope (src/lib/retention.ts)
      //    plus template and font assets, which a press hard-delete also owns.
      const [cardholders, cardAssets, templates, pdfJobs, fonts] = await Promise.all([
        prisma.cardholder.findMany({ where: { pressId }, select: { photoUrl: true } }),
        prisma.cardAsset.findMany({ where: { pressId }, select: { frontUrl: true, backUrl: true } }),
        prisma.cardTemplate.findMany({
          where: { pressId },
          select: {
            frontImageUrl: true, backImageUrl: true,
            frontOriginalUrl: true, backOriginalUrl: true,
            cdrFileUrl: true, aiFileUrl: true, psdFileUrl: true, pdfFileUrl: true,
          },
        }),
        prisma.pdfJob.findMany({ where: { pressId }, select: { id: true, downloadUrl: true } }),
        prisma.pressFont.findMany({ where: { pressId }, select: { fileUrl: true } }),
      ]);

      const pdfJobIds = pdfJobs.map((j) => j.id);
      const chunks = pdfJobIds.length
        ? await prisma.pdfJobChunk.findMany({ where: { pdfJobId: { in: pdfJobIds } }, select: { downloadUrl: true } })
        : [];

      const r2Keys: string[] = [];
      for (const ch of cardholders) if (ch.photoUrl) r2Keys.push(ch.photoUrl);
      for (const a of cardAssets) {
        if (a.frontUrl) r2Keys.push(a.frontUrl);
        if (a.backUrl) r2Keys.push(a.backUrl);
      }
      for (const t of templates) {
        for (const url of [t.frontImageUrl, t.backImageUrl, t.frontOriginalUrl, t.backOriginalUrl, t.cdrFileUrl, t.aiFileUrl, t.psdFileUrl, t.pdfFileUrl]) {
          if (url) r2Keys.push(url);
        }
      }
      for (const j of pdfJobs) if (j.downloadUrl) r2Keys.push(j.downloadUrl);
      for (const c of chunks) if (c.downloadUrl) r2Keys.push(c.downloadUrl);
      for (const f of fonts) if (f.fileUrl) r2Keys.push(f.fileUrl);

      // 2. Clean up Cloudinary assets if configured (legacy/dormant path — kept
      //    for any deployment still using Cloudinary instead of R2).
      if (isCloudinaryConfigured) {
        try {
          for (const ch of cardholders) {
            if (ch.photoUrl) {
              const pubId = getCloudinaryPublicId(ch.photoUrl);
              if (pubId) {
                await cloudinary.uploader.destroy(pubId, { resource_type: 'image' }).catch(() => {});
              }
            }
          }

          await cloudinary.api.delete_resources_by_prefix(`press_${pressId}/`, { resource_type: 'raw' }).catch(() => {});
          await cloudinary.api.delete_resources_by_prefix(`press_${pressId}/`, { resource_type: 'image' }).catch(() => {});
        } catch (cloudErr) {
          console.error('Cloudinary cleanup warning during hard delete:', cloudErr);
        }
      }

      // 3. Perform Transactional Hard Delete in DB
      await prisma.$transaction(async (tx) => {
        // Delete portal shares first
        await tx.clientPortalShare.deleteMany({
          where: { pressId },
        });

        // Hard Delete the Press (Cascades to PressUser, Client, Cardholder, CardOrder, OrderInvoice, CardTemplate, PdfJob, etc.)
        await tx.press.delete({
          where: { id: pressId },
        });

        // Audit Log
        await tx.systemAuditLog.create({
          data: {
            pressId: null,
            actorType: 'SUPER_ADMIN',
            actorName: 'Super Admin',
            action: 'HARD_DELETE_PRESS',
            category: 'USER',
            resourceType: 'Press',
            resourceId: String(pressId),
            description: `Permanently hard deleted Press "${press.name}" (${press.email}) and all associated records.`,
            ipAddress: getClientIp(request),
            severity: 'CRITICAL',
          },
        });
      });

      // 4. Reclaim the R2 objects now that the DB rows pointing at them are
      //    gone. Best-effort and last: the DB delete already succeeded and is
      //    the source of truth, so a partial R2 sweep only leaves orphans
      //    (the previous status quo) rather than a live row pointing at a
      //    deleted file.
      const { deleted: filesDeleted, failed: filesFailed } = await deleteManyFromR2(r2Keys);
      if (filesFailed.length > 0) {
        console.error(`Press ${pressId} hard-delete: ${filesFailed.length} R2 object(s) failed to delete:`, filesFailed);
      }

      return NextResponse.json({
        success: true,
        message: `Press "${press.name}" and all associated records have been hard deleted permanently.`,
        filesDeleted,
        filesFailed: filesFailed.length,
      });
    });
  } catch (error: unknown) {
    console.error('Superadmin hard delete press error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
