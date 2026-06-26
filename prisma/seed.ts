import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── helpers ─────────────────────────────────────────────────────────────────

async function upsertSuperAdmin(
  email: string,
  name: string,
  password: string,
) {
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.superAdmin.upsert({
    where: { email },
    update: { name, passwordHash },
    create: { email, name, passwordHash },
  });
  console.log(`✅  SuperAdmin upserted : ${email}  (pw: ${password})`);
}

async function upsertPressUser(
  pressId: number,
  email: string,
  name: string,
  password: string,
  role: 'OWNER' | 'OPERATOR' | 'DESIGNER',
) {
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await prisma.pressUser.findUnique({ where: { email } });
  if (existing) {
    await prisma.pressUser.update({
      where: { email },
      data: { name, passwordHash, role, pressId, active: true },
    });
    console.log(`🔄  PressUser updated  : ${email}  role: ${role}  (pw: ${password})`);
  } else {
    await prisma.pressUser.create({
      data: { pressId, email, name, passwordHash, role, active: true },
    });
    console.log(`✅  PressUser created  : ${email}  role: ${role}  (pw: ${password})`);
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱  Seeding database…\n');

  // ── 1. SUPER ADMINS ────────────────────────────────────────────────────────
  console.log('── Super Admins ──');
  await upsertSuperAdmin(
    'admin@idexo.app',
    'Platform Admin',
    'Admin@1234',
  );
  await upsertSuperAdmin(
    'ops@idexo.app',
    'Ops Manager',
    'Ops@5678',
  );
  await upsertSuperAdmin(
    'support@idexo.app',
    'Support Lead',
    'Support@9999',
  );

  // ── 2. PRESS (TENANT) ──────────────────────────────────────────────────────
  console.log('\n── Press Tenant ──');
  const pressEmail = 'contact@springfieldpress.com';
  let press = await prisma.press.findUnique({ where: { email: pressEmail } });

  if (!press) {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    press = await prisma.press.create({
      data: {
        name: 'Springfield Printing Press',
        email: pressEmail,
        phone: '+91 98765 43210',
        city: 'Bangalore',
        plan: 'PRO',
        isActive: true,
        credits: 500,
        trialEndsAt,
      },
    });
    console.log(`✅  Press created       : ${press.name}  (id: ${press.id})`);
  } else {
    // Make sure press is active
    press = await prisma.press.update({
      where: { id: press.id },
      data: { isActive: true },
    });
    console.log(`ℹ️   Press updated/active: ${press.name}  (id: ${press.id})`);
  }

  // Press owner & staff logins
  await upsertPressUser(
    press.id,
    'ravi@springfieldpress.com',
    'Ravi Kumar',
    'Press@Owner1',
    'OWNER',
  );

  await upsertPressUser(
    press.id,
    'staff@springfieldpress.com',
    'Amit Singh',
    'staffpassword',
    'OPERATOR',
  );

  await upsertPressUser(
    press.id,
    'designer@springfieldpress.com',
    'Neha Roy',
    'designerpassword',
    'DESIGNER',
  );

  // ── 3. CLIENTS ────────────────────────────────────────────────────────────
  console.log('\n── Clients ──');

  // — Client A: School ———————————————————————————————————————————————————————
  const schoolName = 'Greenwood Public School';
  let school = await prisma.client.findFirst({
    where: { pressId: press.id, name: schoolName },
  });
  if (!school) {
    school = await prisma.client.create({
      data: {
        pressId: press.id,
        name: schoolName,
        type: 'SCHOOL',
        contactName: 'Mrs. Priya Sharma',
        contactPhone: '+91 80123 45678',
        contactEmail: 'principal@greenwoodschool.edu.in',
        address: '12 MG Road, Bengaluru, Karnataka – 560001',
      },
    });
    console.log(`✅  Client created      : ${school.name}  type: SCHOOL  (id: ${school.id})`);
  } else {
    console.log(`ℹ️   Client exists       : ${school.name}  (id: ${school.id})`);
  }

  // — Client B: NGO ——————————————————————————————————————————————————————————
  const ngoName = 'Asha Kiran Foundation';
  let ngo = await prisma.client.findFirst({
    where: { pressId: press.id, name: ngoName },
  });
  if (!ngo) {
    ngo = await prisma.client.create({
      data: {
        pressId: press.id,
        name: ngoName,
        type: 'NGO',
        contactName: 'Mr. Arun Mehta',
        contactPhone: '+91 99887 76655',
        contactEmail: 'info@ashakiran.org',
        address: '45 Nehru Nagar, Pune, Maharashtra – 411001',
      },
    });
    console.log(`✅  Client created      : ${ngo.name}  type: NGO  (id: ${ngo.id})`);
  } else {
    console.log(`ℹ️   Client exists       : ${ngo.name}  (id: ${ngo.id})`);
  }

  // ── SUMMARY ────────────────────────────────═══════════════════════════════
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                     SEED CREDENTIALS                        ║
╠══════════════════════════════════════════════════════════════╣
║  SUPER ADMIN PORTAL (/superadmin/login)                      ║
║  admin@idexo.app          pw: Admin@1234                     ║
║  ops@idexo.app            pw: Ops@5678                       ║
║  support@idexo.app        pw: Support@9999                   ║
╠══════════════════════════════════════════════════════════════╣
║  PRESS TENANT PORTAL (/login)                                ║
║  ravi@springfieldpress.com  pw: Press@Owner1  role: OWNER    ║
║  staff@springfieldpress.com pw: staffpassword role: OPERATOR ║
║  designer@springfieldpress.com pw: designerpassword DESIGNER ║
╠══════════════════════════════════════════════════════════════╣
║  CLIENTS (under Springfield Press)                           ║
║  • Greenwood Public School  (type: SCHOOL)                   ║
║  • Asha Kiran Foundation    (type: NGO)                      ║
╚══════════════════════════════════════════════════════════════╝
`);

  console.log('🎉  Seeding completed!\n');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
