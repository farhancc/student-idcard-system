import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.pressUser.findMany();
  console.log('Press Users Count:', users.length);
  for (const u of users) {
    console.log(`- User: ${u.email}, PressID: ${u.pressId}, Name: ${u.name}, Role: ${u.role}`);
  }
}

main().finally(() => prisma.$disconnect());
