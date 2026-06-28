import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- PRESSES ---');
  const presses = await prisma.press.findMany();
  console.log(JSON.stringify(presses, null, 2));

  console.log('--- PRESS USERS ---');
  const pressUsers = await prisma.pressUser.findMany();
  console.log(JSON.stringify(pressUsers, null, 2));

  console.log('--- CLIENTS ---');
  const clients = await prisma.client.findMany();
  console.log(JSON.stringify(clients, null, 2));

  console.log('--- TEMPLATES ---');
  const templates = await prisma.cardTemplate.findMany();
  console.log(JSON.stringify(templates, null, 2));
  
  console.log('--- ORDERS ---');
  const orders = await prisma.cardOrder.findMany();
  console.log(JSON.stringify(orders, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
