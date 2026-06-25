import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Seed Super Admin
  const adminEmail = 'admin@studentidsystem.com';
  const existingAdmin = await prisma.superAdmin.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const adminPasswordHash = await bcrypt.hash('superadminpassword', 10);
    await prisma.superAdmin.create({
      data: {
        email: adminEmail,
        passwordHash: adminPasswordHash,
        name: 'Platform Admin',
      },
    });
    console.log(`✅ Super Admin created: ${adminEmail}`);
  } else {
    console.log(`ℹ️ Super Admin ${adminEmail} already exists`);
  }

  // 2. Seed a test Press tenant
  const pressEmail = 'contact@springfieldpress.com';
  let press = await prisma.press.findUnique({
    where: { email: pressEmail },
  });

  if (!press) {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30); // 30 days trial for test seed

    press = await prisma.press.create({
      data: {
        name: 'Springfield Printing Press',
        email: pressEmail,
        phone: '+91 98765 43210',
        city: 'Bangalore',
        plan: 'PRO',
        isActive: true,
        trialEndsAt,
      },
    });
    console.log(`✅ Press Tenant created: ${press.name}`);
  } else {
    console.log(`ℹ️ Press Tenant ${press.name} already exists`);
  }

  // 3. Seed an OWNER user for the press
  const ownerEmail = 'ravi@springfieldpress.com';
  const existingOwner = await prisma.pressUser.findUnique({
    where: { email: ownerEmail },
  });

  if (!existingOwner) {
    const ownerPasswordHash = await bcrypt.hash('presspassword', 10);
    await prisma.pressUser.create({
      data: {
        pressId: press.id,
        name: 'Ravi Kumar',
        email: ownerEmail,
        passwordHash: ownerPasswordHash,
        role: 'OWNER',
        active: true,
      },
    });
    console.log(`✅ Press OWNER user created: ${ownerEmail}`);
  } else {
    console.log(`ℹ️ Press OWNER user ${ownerEmail} already exists`);
  }

  // 4. Seed an OPERATOR user for the press
  const operatorEmail = 'staff@springfieldpress.com';
  const existingOperator = await prisma.pressUser.findUnique({
    where: { email: operatorEmail },
  });

  if (!existingOperator) {
    const operatorPasswordHash = await bcrypt.hash('staffpassword', 10);
    await prisma.pressUser.create({
      data: {
        pressId: press.id,
        name: 'Amit Singh',
        email: operatorEmail,
        passwordHash: operatorPasswordHash,
        role: 'OPERATOR',
        active: true,
      },
    });
    console.log(`✅ Press OPERATOR user created: ${operatorEmail}`);
  } else {
    console.log(`ℹ️ Press OPERATOR user ${operatorEmail} already exists`);
  }

  // 5. Seed a DESIGNER user for the press
  const designerEmail = 'designer@springfieldpress.com';
  const existingDesigner = await prisma.pressUser.findUnique({
    where: { email: designerEmail },
  });

  if (!existingDesigner) {
    const designerPasswordHash = await bcrypt.hash('designerpassword', 10);
    await prisma.pressUser.create({
      data: {
        pressId: press.id,
        name: 'Neha Roy',
        email: designerEmail,
        passwordHash: designerPasswordHash,
        role: 'DESIGNER',
        active: true,
      },
    });
    console.log(`✅ Press DESIGNER user created: ${designerEmail}`);
  } else {
    console.log(`ℹ️ Press DESIGNER user ${designerEmail} already exists`);
  }

  console.log('Seeding completed successfully! 🎉');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
