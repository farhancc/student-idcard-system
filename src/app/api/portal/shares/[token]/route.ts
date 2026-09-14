import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enterPortalTenant } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    // Resolve the token to its press before any tenant-scoped query runs.
    if ((await enterPortalTenant(token)) === null) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

    // 1. Check if token matches orgToken in ClientPortalShare
    let share = await prisma.clientPortalShare.findUnique({
      where: { orgToken: token, active: true },
    });

    let type: 'org' | 'dept' | 'enroll' = 'org';
    let departmentName: string | null = null;
    let enrollToken: string | null = null;

    if (share) {
      type = 'org';
      enrollToken = share.enrollToken;
    } else {
      // 2. Check if token matches deptToken in ClientDepartment
      const dept = await prisma.clientDepartment.findUnique({
        where: { deptToken: token },
        include: { portalShare: true },
      });

      if (dept && dept.portalShare.active) {
        share = dept.portalShare;
        type = 'dept';
        departmentName = dept.name;
        enrollToken = dept.enrollToken;
      } else {
        // 3. Check if token matches enrollToken in ClientDepartment
        const enrollDept = await prisma.clientDepartment.findUnique({
          where: { enrollToken: token },
          include: { portalShare: true },
        });

        if (enrollDept && enrollDept.portalShare.active) {
          share = enrollDept.portalShare;
          type = 'enroll';
          departmentName = enrollDept.name;
          enrollToken = enrollDept.enrollToken;
        } else {
          // 4. Check if token matches global enrollToken in ClientPortalShare
          share = await prisma.clientPortalShare.findUnique({
            where: { enrollToken: token, active: true },
          });

          if (share) {
            type = 'enroll';
            enrollToken = share.enrollToken;
          }
        }
      }
    }

    if (!share) {
      return NextResponse.json({ error: 'Invalid or deactivated portal link' }, { status: 404 });
    }

    // Fetch Client and Template details
    const client = await prisma.client.findUnique({
      where: { id: share.clientId },
      select: { id: true, name: true, type: true, pressId: true },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    let template = await prisma.cardTemplate.findUnique({
      where: { id: share.templateId },
      select: {
        id: true,
        name: true,
        cardWidth: true,
        cardHeight: true,
        frontImageUrl: true,
        backImageUrl: true,
        frontOriginalUrl: true,
        backOriginalUrl: true,
        frontFields: true,
        backFields: true,
        version: true,
        parentId: true,
        pressId: true,
        clientId: true,
      },
    });

    if (template) {
      // Always resolve the latest updated version of the template so new fields, styles & layout changes apply live
      const latestVersion = await prisma.cardTemplate.findFirst({
        where: {
          OR: [
            { id: template.id },
            { parentId: template.id },
            ...(template.parentId ? [{ id: template.parentId }, { parentId: template.parentId }] : []),
            ...(template.name ? [{ name: template.name, ...(template.pressId ? { pressId: template.pressId } : {}) }] : [])
          ],
          isLatest: true
        },
        orderBy: [
          { version: 'desc' },
          { id: 'desc' }
        ],
        select: {
          id: true,
          name: true,
          cardWidth: true,
          cardHeight: true,
          frontImageUrl: true,
          backImageUrl: true,
          frontOriginalUrl: true,
          backOriginalUrl: true,
          frontFields: true,
          backFields: true,
          version: true,
        }
      });

      if (latestVersion) {
        template = { ...template, ...latestVersion };
      }
    }

    // Fetch all available templates for this client
    const assignedTemplates = await prisma.templateClientAssignment.findMany({
      where: { clientId: share.clientId },
      include: {
        template: {
          select: { id: true, name: true }
        }
      }
    });

    const directTemplates = await prisma.cardTemplate.findMany({
      where: { clientId: share.clientId },
      select: { id: true, name: true }
    });

    const templatesMap = new Map<number, { id: number; name: string }>();
    if (template) {
      templatesMap.set(template.id, { id: template.id, name: template.name });
    }
    assignedTemplates.forEach(a => {
      if (a.template) templatesMap.set(a.template.id, { id: a.template.id, name: a.template.name });
    });
    directTemplates.forEach(t => {
      templatesMap.set(t.id, { id: t.id, name: t.name });
    });

    const clientTemplates = Array.from(templatesMap.values());

    const pressFonts = await prisma.pressFont.findMany({
      where: {
        OR: [
          { pressId: client.pressId },
          { pressId: null }
        ]
      },
      select: { name: true, fileUrl: true },
    });

    // Fetch latest approval job
    const latestApprovalJob = await prisma.pdfJob.findFirst({
      where: {
        order: {
          clientId: share.clientId,
          templateId: share.templateId,
        },
        pdfType: 'APPROVAL',
        status: 'COMPLETED',
      },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        status: true,
        progress: true,
        downloadUrl: true,
      },
    });

    const shareResponse: any = {
      id: share.id,
      enrollToken: enrollToken || share.enrollToken,
      showPreview: share.showPreview,
      createdAt: share.createdAt,
    };

    if (type !== 'enroll') {
      shareResponse.orgToken = share.orgToken;
    }

    return NextResponse.json({
      success: true,
      type,
      client: {
        ...client,
        templates: clientTemplates,
      },
      template,
      departmentName,
      latestApprovalJob,
      pressFonts,
      share: shareResponse,
    });
  } catch (error) {
    console.error('Get portal share details error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    // Resolve the token to its press before any tenant-scoped query runs.
    if ((await enterPortalTenant(token)) === null) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

    // Only allow deactivating via orgToken
    const share = await prisma.clientPortalShare.findFirst({
      where: { orgToken: token },
    });

    if (!share) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

    await prisma.clientPortalShare.update({
      where: { id: share.id },
      data: { active: false },
    });

    return NextResponse.json({ success: true, message: 'Portal link deactivated successfully' });
  } catch (error) {
    console.error('Deactivate portal share error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    // Resolve the token to its press before any tenant-scoped query runs.
    if ((await enterPortalTenant(token)) === null) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

    const share = await prisma.clientPortalShare.findFirst({
      where: { orgToken: token },
    });

    if (!share) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

    const body = await request.json();
    const { showPreview } = body;

    if (typeof showPreview !== 'boolean') {
      return NextResponse.json({ error: 'showPreview must be a boolean' }, { status: 400 });
    }

    const updated = await prisma.clientPortalShare.update({
      where: { id: share.id },
      data: { showPreview },
    });

    return NextResponse.json({ success: true, showPreview: updated.showPreview });
  } catch (error) {
    console.error('Update portal share settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
