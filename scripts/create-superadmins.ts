import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  const all = upper + lower + digits + symbols;
  const pick = (set: string) => set[crypto.randomInt(set.length)];
  const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const rest = Array.from({ length: 12 }, () => pick(all));
  const chars = [...required, ...rest];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

async function main() {
  const accounts = [
    { email: 'admin1@idexocards.com', name: 'Super Admin 1' },
    { email: 'admin2@idexocards.com', name: 'Super Admin 2' },
    { email: 'admin3@idexocards.com', name: 'Super Admin 3' },
  ];

  console.log('\nSuperadmin credentials (shown once, not stored anywhere) —\n');

  for (const { email, name } of accounts) {
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.superAdmin.upsert({
      where: { email },
      update: { name, passwordHash },
      create: { email, name, passwordHash },
    });
    console.log(`  ${email}  /  ${password}`);
  }

  console.log('\nLog in at /superadmin/login\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
