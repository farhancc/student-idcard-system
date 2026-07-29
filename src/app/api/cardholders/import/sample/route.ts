import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export async function GET() {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Cardholders');

    sheet.columns = [
      { header: 'name', key: 'name', width: 25 },
      { header: 'designation', key: 'designation', width: 20 },
      { header: 'admissionNo', key: 'admissionNo', width: 15 },
    ];

    sheet.addRow({ name: 'John Doe', designation: 'Student', admissionNo: '2026-001' });
    sheet.addRow({ name: 'Jane Smith', designation: 'Teacher', admissionNo: 'EMP-102' });

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="sample_cardholders.xlsx"',
      },
    });
  } catch (error) {
    console.error('Error generating sample Excel:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
