import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding analytics data...');

  const pressId = 1; // Springfield Printing Press
  
  // Dynamic template creation to avoid FK violations
  let template = await prisma.cardTemplate.findFirst({
    where: { pressId }
  });
  if (!template) {
    template = await prisma.cardTemplate.create({
      data: {
        pressId,
        name: 'Standard School Card',
        cardWidth: 673,
        cardHeight: 1039,
        frontImageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        frontFields: '[]',
        backImageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        backFields: '[]',
      }
    });
  }
  const templateId = template.id;
  const clientId = 1; // Greenwood Public School
  const userId = 1; // Ravi Kumar

  // 1. Create cardholders
  console.log('Creating mock cardholders...');
  const cardholdersData = [];
  for (let i = 1; i <= 200; i++) {
    cardholdersData.push({
      pressId,
      clientId,
      name: `Student Name ${i}`,
      designation: `Grade ${Math.floor(Math.random() * 12) + 1}`,
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      uniqueKey: `STU${String(i).padStart(4, '0')}`,
      cardSerial: `GPS${String(i).padStart(4, '0')}`,
    });
  }

  // Delete existing ones to prevent duplicates if any
  await prisma.cardholder.deleteMany({ where: { pressId } });

  // Use createMany to insert them
  await prisma.cardholder.createMany({
    data: cardholdersData,
  });

  const allCardholders = await prisma.cardholder.findMany({
    where: { pressId },
  });

  console.log(`Seeded ${allCardholders.length} cardholders.`);

  // Clean old orders, jobs, invoices for pressId 1
  await prisma.pdfJob.deleteMany({ where: { pressId } });
  await prisma.orderInvoice.deleteMany({ where: { pressId } });
  await prisma.cardOrder.deleteMany({ where: { pressId } });

  // 2. Generate monthly data
  // Last 6 months: Feb, Mar, Apr, May, Jun, Jul 2026
  const months = [
    { name: 'Feb', year: 2026, monthIdx: 1, cardCount: 120, rate: 50 },
    { name: 'Mar', year: 2026, monthIdx: 2, cardCount: 180, rate: 50 },
    { name: 'Apr', year: 2026, monthIdx: 3, cardCount: 240, rate: 50 },
    { name: 'May', year: 2026, monthIdx: 4, cardCount: 150, rate: 50 },
    { name: 'Jun', year: 2026, monthIdx: 5, cardCount: 300, rate: 50 },
    { name: 'Jul', year: 2026, monthIdx: 6, cardCount: 80, rate: 50 },
  ];

  let cardholderOffset = 0;

  for (const m of months) {
    const createdAt = new Date(m.year, m.monthIdx, 15, 12, 0, 0);
    const completedAt = new Date(m.year, m.monthIdx, 16, 14, 0, 0);

    // Create an order
    const order = await prisma.cardOrder.create({
      data: {
        pressId,
        clientId,
        templateId,
        status: 'DELIVERED',
        createdAt,
        updatedAt: completedAt,
      },
    });

    // Link cardholders to the order
    const batchCardholders = allCardholders.slice(cardholderOffset, cardholderOffset + m.cardCount);
    cardholderOffset = (cardholderOffset + m.cardCount) % allCardholders.length;

    await prisma.orderCardholder.createMany({
      data: batchCardholders.map(ch => ({
        orderId: order.id,
        cardholderId: ch.id,
        addedAt: createdAt,
      })),
    });

    // Create a completed production job for this order
    await prisma.pdfJob.create({
      data: {
        pressId,
        orderId: order.id,
        pdfType: 'PRODUCTION',
        status: 'COMPLETED',
        fileName: `${m.name.toLowerCase()}_production_print.pdf`,
        generatedBy: userId,
        progress: 100,
        creditsLocked: 0,
        creditsUsed: m.cardCount,
        rateApplied: m.rate,
        revenueGenerated: m.cardCount * m.rate,
        generatedAt: createdAt,
        completedAt,
      },
    });

    // Create a completed invoice for this order
    const subtotal = m.cardCount * m.rate;
    const taxPercent = 18;
    const taxAmount = (subtotal * taxPercent) / 100;
    const totalAmount = subtotal + taxAmount;

    await prisma.orderInvoice.create({
      data: {
        orderId: order.id,
        pressId,
        pricePerCard: m.rate,
        cardCount: m.cardCount,
        subtotal,
        taxPercent,
        taxAmount,
        totalAmount,
        paymentStatus: 'PAID',
        paymentMethod: 'UPI',
        paidAmount: totalAmount,
        paidAt: completedAt,
        createdAt,
      },
    });

    console.log(`Seeded month ${m.name} with ${m.cardCount} cards and Rs. ${totalAmount} revenue.`);
  }

  console.log('Analytics data seeding completed successfully!');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
