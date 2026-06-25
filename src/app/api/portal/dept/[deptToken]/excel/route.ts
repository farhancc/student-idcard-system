import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ deptToken: string }> }
) {
  try {
    const { deptToken } = await params;
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');

    const dept = await prisma.clientDepartment.findUnique({
      where: { deptToken },
      include: { portalShare: true },
    });

    if (!dept || !dept.portalShare.active) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

    const client = await prisma.client.findUnique({
      where: { id: dept.portalShare.clientId },
    });
    const template = await prisma.cardTemplate.findUnique({
      where: { id: dept.portalShare.templateId },
    });

    if (!client || !template) {
      return NextResponse.json({ error: 'Client or Template not found' }, { status: 404 });
    }

    let idsArray: number[] = [];
    if (idsParam) {
      idsArray = idsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    }

    const whereClause: any = {
      clientId: dept.portalShare.clientId,
      pressId: dept.portalShare.pressId,
      enrollToken: dept.enrollToken,
    };

    if (idsArray.length > 0) {
      whereClause.id = { in: idsArray };
    }

    // Get cardholders
    const cardholders = await prisma.cardholder.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
    });

    if (cardholders.length === 0) {
      return NextResponse.json({ error: 'No cardholders found' }, { status: 400 });
    }

    // Extract template fields in order
    const front = JSON.parse(template.frontFields || '[]');
    const back = JSON.parse(template.backFields || '[]');
    const allFields: any[] = [...front, ...back];
    
    const imageFields = allFields.filter(f => f.type === 'image');
    const mainPhoto = imageFields.find(f => f.field === 'photo' || f.field === 'avatar') || imageFields[0] || null;

    const templateFields: any[] = [];
    const seen = new Set<string>();
    
    if (mainPhoto) {
      templateFields.push({ field: mainPhoto.field, type: 'image', isMainPhoto: true });
      seen.add(mainPhoto.field);
    }
    
    const nameField = allFields.find(f => f.field === 'name' || f.field === 'fullName');
    if (nameField) {
      templateFields.push({ field: nameField.field, type: 'text', isName: true });
      seen.add(nameField.field);
    }
    
    allFields.forEach(f => {
      if (seen.has(f.field)) return;
      templateFields.push({
        field: f.field,
        type: f.type
      });
      seen.add(f.field);
    });

    // Map cardholder details to Excel rows matching table columns exactly
    const data = cardholders.map(ch => {
      let parsedCustom: Record<string, string> = {};
      try {
        parsedCustom = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields || '{}') : (ch.customFields || {});
      } catch (e) {
        parsedCustom = {};
      }

      const row: Record<string, any> = {};

      templateFields.forEach(tf => {
        const label = tf.field.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase());
        
        if (tf.isMainPhoto) {
          row[label] = ch.photoUrl || '';
        } else if (tf.isName) {
          row[label] = ch.name;
        } else if (tf.field === 'designation' || tf.field === 'role') {
          row[label] = ch.designation || '';
        } else if (tf.field === 'uniqueKey') {
          row[label] = ch.uniqueKey || '';
        } else {
          row[label] = parsedCustom[tf.field] || '';
        }
      });

      // Add Enrolled On
      row['Enrolled On'] = ch.createdAt.toISOString().split('T')[0];

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cardholders');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Cardholders_${client.name.replace(/\s+/g, '_')}_${dept.name.replace(/\s+/g, '_')}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Dept download Excel error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
