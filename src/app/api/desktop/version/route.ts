import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    minimumVersion: '1.0.0',
    latestVersion: '1.0.0',
    downloadUrl: {
      linux: 'https://cdn.studentidsystem.com/press-client/releases/IDCardPressClient-1.0.0.AppImage',
      windows: 'https://cdn.studentidsystem.com/press-client/releases/IDCardPressClient-Setup-1.0.0.exe',
      mac: 'https://cdn.studentidsystem.com/press-client/releases/IDCardPressClient-1.0.0.dmg'
    }
  });
}
