import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    minimumVersion: '1.0.1',
    latestVersion: '1.0.1',
    downloadUrl: {
      linux: 'https://cdn.studentidsystem.com/press-client/releases/IDCardPressClient-1.0.1.AppImage',
      windows: 'https://cdn.studentidsystem.com/press-client/releases/IDCardPressClient-1.0.1-win.zip',
      mac: 'https://cdn.studentidsystem.com/press-client/releases/IDCardPressClient-1.0.1.dmg'
    }
  });
}
