const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.cardTemplate.count();
  console.log('Total templates in DB:', count);

  const templates = await prisma.cardTemplate.findMany({
    select: {
      id: true,
      name: true,
      isPublic: true,
      isModerated: true,
      isLatest: true,
      pressId: true,
    }
  });
  console.log('Templates list:');
  console.log(JSON.stringify(templates, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
