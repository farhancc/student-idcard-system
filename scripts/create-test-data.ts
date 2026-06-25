import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import AdmZip from 'adm-zip';
import sharp from 'sharp';

async function main() {
  const publicSamplesDir = path.join(process.cwd(), 'public', 'samples');
  fs.mkdirSync(publicSamplesDir, { recursive: true });

  // 1. Create Excel File
  const excelData = [
    {
      "rollno": "101",
      "name": "Alice Smith",
      "class": "Class 10",
      "blood_group": "A+"
    },
    {
      "rollno": "102",
      "name": "Bob Johnson",
      "class": "Class 11",
      "blood_group": "B+"
    },
    {
      "rollno": "103",
      "name": "Charlie Brown",
      "class": "Class 12",
      "blood_group": "O-"
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
  
  const excelPath = path.join(publicSamplesDir, 'test_cardholders.xlsx');
  XLSX.writeFile(workbook, excelPath);
  console.log(`Excel file created at: ${excelPath}`);

  // 2. Create images and zip them
  const zip = new AdmZip();

  // Create red, green, blue solid square images
  const colors = [
    { name: '101.jpg', color: { r: 220, g: 38, b: 38 } }, // Red
    { name: '102.jpg', color: { r: 22, g: 163, b: 74 } }, // Green
    { name: '103.jpg', color: { r: 37, g: 99, b: 235 } }  // Blue
  ];

  for (const item of colors) {
    const buffer = await sharp({
      create: {
        width: 150,
        height: 150,
        channels: 3,
        background: item.color
      }
    })
    .jpeg()
    .toBuffer();

    zip.addFile(item.name, buffer);
  }

  const zipPath = path.join(publicSamplesDir, 'test_photos.zip');
  zip.writeZip(zipPath);
  console.log(`ZIP file created at: ${zipPath}`);
}

main().catch(err => {
  console.error("Error creating sample files:", err);
  process.exit(1);
});
