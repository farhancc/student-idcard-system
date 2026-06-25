import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';

function main() {
  const zip = new AdmZip();
  
  const lisaImgPath = '/home/farhan/.gemini/antigravity/brain/377656ed-5d06-4c43-a028-91724232de13/lisa_avatar_1782013269940.png';
  const milhouseImgPath = '/home/farhan/.gemini/antigravity/brain/377656ed-5d06-4c43-a028-91724232de13/milhouse_avatar_1782013284087.png';

  if (!fs.existsSync(lisaImgPath)) {
    console.error('Lisa image not found at', lisaImgPath);
    return;
  }
  if (!fs.existsSync(milhouseImgPath)) {
    console.error('Milhouse image not found at', milhouseImgPath);
    return;
  }

  // Read files
  const lisaData = fs.readFileSync(lisaImgPath);
  const milhouseData = fs.readFileSync(milhouseImgPath);

  // Add to zip
  zip.addFile('LISA-01.png', lisaData);
  zip.addFile('MILHOUSE-02.png', milhouseData);

  // Save zip
  const outPath = path.join(process.cwd(), 'sample_photos.zip');
  zip.writeZip(outPath);
  console.log('ZIP file created successfully at:', outPath);
}

main();
