import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    const data = [
      { name: 'John Doe', designation: 'Student', uniqueKey: 'STU-001', admissionNo: '2026-001' },
      { name: 'Jane Smith', designation: 'Teacher', uniqueKey: 'TCH-102', employeeId: 'EMP-102' }
    ];

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cardholders');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

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
