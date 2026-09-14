import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { requireActor } from '@/lib/authz';

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

export async function POST(request: Request) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

    if (!isCloudinaryConfigured) {
      return NextResponse.json({ success: false, message: 'Cloudinary not configured' });
    }

    const body = await request.json();
    let { folder, publicId, overwrite } = body;

    // Sanitize folder path to prevent directory traversal or arbitrary tag injection
    if (folder) {
      folder = String(folder).replace(/[^a-zA-Z0-9_\-\/]/g, '');
    } else {
      folder = `idexo_assets/press_${pressId}`;
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // Build parameters to sign (keys must be sorted alphabetically, but api_sign_request does this automatically)
    const paramsToSign: Record<string, any> = {
      timestamp,
    };
    if (folder) paramsToSign.folder = folder;
    if (publicId) paramsToSign.public_id = String(publicId).replace(/[^a-zA-Z0-9_\-]/g, '');
    if (overwrite !== undefined) paramsToSign.overwrite = String(overwrite);

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET!
    );

    return NextResponse.json({
      success: true,
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (err: unknown) {
    console.error('Signing error:', err);
    return NextResponse.json({ error: 'Failed to sign upload request' }, { status: 500 });
  }
}
