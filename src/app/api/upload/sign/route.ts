import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

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
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }

    if (!isCloudinaryConfigured) {
      return NextResponse.json({ success: false, message: 'Cloudinary not configured' });
    }

    const body = await request.json();
    const { folder, publicId, overwrite } = body;

    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // Build parameters to sign (keys must be sorted alphabetically, but api_sign_request does this automatically)
    const paramsToSign: Record<string, any> = {
      timestamp,
    };
    if (folder) paramsToSign.folder = folder;
    if (publicId) paramsToSign.public_id = publicId;
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
  } catch (err: any) {
    console.error('Signing error:', err);
    return NextResponse.json({ error: err.message || 'Failed to sign upload request' }, { status: 500 });
  }
}
