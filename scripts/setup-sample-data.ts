/**
 * Setup Script: Creates sample data for demo
 * - Uploads template images (front + back)
 * - Creates CardTemplate in DB
 * - Generates 12 student photos
 * - Creates students.xlsx with 12 students
 * - Creates students_photos.zip with photo files
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import AdmZip from 'adm-zip';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// ── CONFIGURATION ─────────────────────────────────────────
const PRESS_ID = 1;
const CLIENT_ID = 1;  // Springfield Elementary School
const TEMPLATE_FRONT_SRC = path.join(process.cwd(), 'scripts', 'assets', 'id_card_front.png');
const TEMPLATE_BACK_SRC  = path.join(process.cwd(), 'scripts', 'assets', 'id_card_back.png');

// ── STUDENT DATA ──────────────────────────────────────────
const STUDENTS = [
  { name: 'Aarav Sharma',     designation: 'Student', uniqueKey: 'SA-2024-001', class: 'Grade 10-A', bloodGroup: 'O+',  rollNo: '001' },
  { name: 'Priya Patel',      designation: 'Student', uniqueKey: 'SA-2024-002', class: 'Grade 10-A', bloodGroup: 'A+',  rollNo: '002' },
  { name: 'Rohan Mehta',      designation: 'Student', uniqueKey: 'SA-2024-003', class: 'Grade 10-B', bloodGroup: 'B+',  rollNo: '003' },
  { name: 'Ananya Singh',     designation: 'Student', uniqueKey: 'SA-2024-004', class: 'Grade 10-B', bloodGroup: 'AB+', rollNo: '004' },
  { name: 'Karan Verma',      designation: 'Student', uniqueKey: 'SA-2024-005', class: 'Grade 11-A', bloodGroup: 'O-',  rollNo: '005' },
  { name: 'Diya Gupta',       designation: 'Student', uniqueKey: 'SA-2024-006', class: 'Grade 11-A', bloodGroup: 'A-',  rollNo: '006' },
  { name: 'Arjun Nair',       designation: 'Student', uniqueKey: 'SA-2024-007', class: 'Grade 11-B', bloodGroup: 'B-',  rollNo: '007' },
  { name: 'Shreya Iyer',      designation: 'Student', uniqueKey: 'SA-2024-008', class: 'Grade 11-B', bloodGroup: 'AB-', rollNo: '008' },
  { name: 'Vikram Reddy',     designation: 'Student', uniqueKey: 'SA-2024-009', class: 'Grade 12-A', bloodGroup: 'O+',  rollNo: '009' },
  { name: 'Meera Krishnan',   designation: 'Student', uniqueKey: 'SA-2024-010', class: 'Grade 12-A', bloodGroup: 'A+',  rollNo: '010' },
  { name: 'Aditya Bose',      designation: 'Student', uniqueKey: 'SA-2024-011', class: 'Grade 12-B', bloodGroup: 'B+',  rollNo: '011' },
  { name: 'Kavya Menon',      designation: 'Student', uniqueKey: 'SA-2024-012', class: 'Grade 12-B', bloodGroup: 'O-',  rollNo: '012' },
];

// ── AVATAR COLORS ─────────────────────────────────────────
const AVATAR_COLORS = [
  ['#1E3A5F', '#4A90D9'], // Navy + Blue
  ['#2E7D32', '#81C784'], // Green
  ['#B71C1C', '#EF9A9A'], // Red
  ['#4527A0', '#B39DDB'], // Purple
  ['#E65100', '#FFCC80'], // Orange
  ['#00695C', '#80CBC4'], // Teal
  ['#1565C0', '#90CAF9'], // Royal Blue
  ['#6A1B9A', '#CE93D8'], // Violet
  ['#AD1457', '#F48FB1'], // Pink
  ['#004D40', '#80CBC4'], // Dark Teal
  ['#37474F', '#B0BEC5'], // Blue Grey
  ['#558B2F', '#AED581'], // Light Green
];

async function generateStudentAvatar(student: typeof STUDENTS[0], index: number): Promise<Buffer> {
  const width = 400;
  const height = 400;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const [bgColor, accentColor] = AVATAR_COLORS[index % AVATAR_COLORS.length];

  // Background gradient
  const grad = ctx.createRadialGradient(200, 200, 50, 200, 200, 220);
  grad.addColorStop(0, accentColor);
  grad.addColorStop(1, bgColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Circle border
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(200, 160, 90, 0, Math.PI * 2);
  ctx.stroke();

  // Silhouette head
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(200, 148, 55, 0, Math.PI * 2);
  ctx.fill();

  // Silhouette body
  ctx.beginPath();
  ctx.ellipse(200, 290, 80, 60, 0, 0, Math.PI * 2);
  ctx.fill();

  // Name initials
  const initials = student.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  ctx.fillStyle = bgColor;
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, 200, 148);

  // Roll number label at bottom
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillRect(0, 340, width, 60);
  ctx.fillStyle = bgColor;
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(student.uniqueKey, 200, 372);

  return canvas.toBuffer('image/png');
}

async function main() {
  console.log('🚀 Starting sample data setup...\n');

  // ── 1. PREPARE TEMPLATE UPLOAD DIR ────────────────────────
  const templateUploadDir = path.join(process.cwd(), 'public', 'uploads', String(PRESS_ID), 'templates');
  fs.mkdirSync(templateUploadDir, { recursive: true });

  // Copy front image
  const frontFileName = `${Date.now()}_front_template.png`;
  const frontDestPath = path.join(templateUploadDir, frontFileName);
  fs.copyFileSync(TEMPLATE_FRONT_SRC, frontDestPath);
  const frontUrl = `/uploads/${PRESS_ID}/templates/${frontFileName}`;
  console.log(`✅ Front template image saved: ${frontUrl}`);

  // Copy back image
  const backFileName = `${Date.now() + 1}_back_template.png`;
  const backDestPath = path.join(templateUploadDir, backFileName);
  fs.copyFileSync(TEMPLATE_BACK_SRC, backDestPath);
  const backUrl = `/uploads/${PRESS_ID}/templates/${backFileName}`;
  console.log(`✅ Back template image saved: ${backUrl}`);

  // ── 2. CREATE CARD TEMPLATE IN DB ─────────────────────────
  // Template field coordinates matching the generated design:
  // Front image is 1024x1024 generated, card is rendered at 1011x638 (landscape CR-80 at 300dpi)
  // Field positions mapped to the card layout:
  // - Photo: left-center circle area (~x:60, y:120, w:250, h:320)
  // - Name: right side row 1 (~x:380, y:130, w:580)
  // - Class (designation): right side row 2 (~x:380, y:220)
  // - Roll No (uniqueKey): right side row 3 (~x:380, y:310)
  // - Blood Group (custom): right side row 4 (~x:380, y:400)
  // - Valid Till: bottom strip (~x:300, y:565)
  const frontFields = JSON.stringify([
    {
      field: 'photo',
      type: 'image',
      x: 60,
      y: 120,
      width: 240,
      height: 300,
      fontSize: 16,
      fontWeight: 'normal',
      color: '#000000',
      align: 'left'
    },
    {
      field: 'name',
      type: 'text',
      x: 380,
      y: 140,
      width: 580,
      height: 60,
      fontSize: 32,
      fontWeight: 'bold',
      color: '#FFFFFF',
      align: 'left'
    },
    {
      field: 'designation',
      type: 'text',
      x: 380,
      y: 220,
      width: 580,
      height: 45,
      fontSize: 24,
      fontWeight: 'normal',
      color: '#E3F2FD',
      align: 'left'
    },
    {
      field: 'class',
      type: 'text',
      x: 380,
      y: 300,
      width: 580,
      height: 45,
      fontSize: 26,
      fontWeight: 'bold',
      color: '#FFFFFF',
      align: 'left',
      prefix: ''
    },
    {
      field: 'rollNo',
      type: 'text',
      x: 380,
      y: 380,
      width: 580,
      height: 40,
      fontSize: 22,
      fontWeight: 'normal',
      color: '#E3F2FD',
      align: 'left',
      prefix: 'Roll: '
    },
    {
      field: 'bloodGroup',
      type: 'text',
      x: 380,
      y: 440,
      width: 280,
      height: 40,
      fontSize: 22,
      fontWeight: 'bold',
      color: '#FFD700',
      align: 'left',
      prefix: 'Blood: '
    },
    {
      field: 'validTill',
      type: 'text',
      x: 300,
      y: 572,
      width: 300,
      height: 35,
      fontSize: 18,
      fontWeight: 'bold',
      color: '#FFFFFF',
      align: 'center',
      prefix: 'Valid Till: '
    }
  ]);

  const backFields = JSON.stringify([
    {
      field: 'uniqueKey',
      type: 'barcode',
      x: 100,
      y: 120,
      width: 800,
      height: 80
    },
    {
      field: 'uniqueKey',
      type: 'text',
      x: 100,
      y: 210,
      width: 800,
      height: 35,
      fontSize: 18,
      fontWeight: 'bold',
      color: '#1E3A5F',
      align: 'center'
    }
  ]);

  const template = await prisma.cardTemplate.create({
    data: {
      pressId: PRESS_ID,
      clientId: null,
      name: 'Springfield Academy Student ID',
      cardWidth: 1011,
      cardHeight: 638,
      frontImageUrl: frontUrl,
      backImageUrl: backUrl,
      frontFields,
      backFields,
      version: 1,
      isLatest: true,
    },
  });

  console.log(`✅ Template created in DB: ID=${template.id}, Name="${template.name}"`);

  // ── 3. GENERATE STUDENT PHOTOS ─────────────────────────────
  console.log('\n📸 Generating student avatar photos...');
  const photoBuffers: { key: string; buffer: Buffer }[] = [];
  for (let i = 0; i < STUDENTS.length; i++) {
    const student = STUDENTS[i];
    const buffer = await generateStudentAvatar(student, i);
    photoBuffers.push({ key: student.uniqueKey, buffer });
    console.log(`  Generated photo for: ${student.name} (${student.uniqueKey})`);
  }

  // ── 4. CREATE EXCEL FILE WITH 12 STUDENTS ─────────────────
  console.log('\n📊 Creating Excel file...');
  const excelData = STUDENTS.map(s => ({
    name: s.name,
    designation: s.designation,
    uniqueKey: s.uniqueKey,
    class: s.class,
    rollNo: s.rollNo,
    bloodGroup: s.bloodGroup,
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Set column widths for readability
  worksheet['!cols'] = [
    { wch: 25 }, // name
    { wch: 12 }, // designation
    { wch: 15 }, // uniqueKey
    { wch: 15 }, // class
    { wch: 10 }, // rollNo
    { wch: 12 }, // bloodGroup
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
  const excelPath = path.join(process.cwd(), 'scripts', 'sample_12_students.xlsx');
  XLSX.writeFile(workbook, excelPath);
  console.log(`✅ Excel file created: ${excelPath}`);

  // ── 5. CREATE PHOTOS ZIP ────────────────────────────────────
  console.log('\n🗜️  Creating photos ZIP file...');
  const zip = new AdmZip();
  for (const { key, buffer } of photoBuffers) {
    zip.addFile(`${key}.png`, buffer);
    console.log(`  Added: ${key}.png`);
  }
  const zipPath = path.join(process.cwd(), 'scripts', 'sample_12_photos.zip');
  zip.writeZip(zipPath);
  console.log(`✅ ZIP file created: ${zipPath}`);

  // ── 6. SUMMARY ─────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    SETUP COMPLETE! 🎉                        ║
╠══════════════════════════════════════════════════════════════╣
║  Template ID    : ${String(template.id).padEnd(42)}║
║  Template Name  : Springfield Academy Student ID             ║
║  Front Image    : ${frontUrl.padEnd(42)}║
║  Back Image     : ${backUrl.padEnd(42)}║
╠══════════════════════════════════════════════════════════════╣
║  Excel File     : scripts/sample_12_students.xlsx            ║
║  ZIP File       : scripts/sample_12_photos.zip               ║
║  Students       : 12                                         ║
╠══════════════════════════════════════════════════════════════╣
║  NEXT: Use the batch import UI to:                           ║
║    - Client ID  : ${String(CLIENT_ID).padEnd(42)}║
║    - Template ID: ${String(template.id).padEnd(42)}║
║    - Upload the Excel + ZIP files above                       ║
╚══════════════════════════════════════════════════════════════╝
  `);

  console.log('\nJSON for reference:');
  console.log(JSON.stringify({ templateId: template.id, clientId: CLIENT_ID, pressId: PRESS_ID }, null, 2));
}

main()
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
