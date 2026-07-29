import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const template = await prisma.cardTemplate.create({
    data: {
      id: 3,
      pressId: 1,
      name: "Springfield Academy Student ID",
      cardWidth: 673,
      cardHeight: 1039,
      frontImageUrl: "/uploads/1/templates/front_template.png",
      frontFields: JSON.stringify([
        {
          field: "photo",
          type: "image",
          x: 60,
          y: 120,
          width: 240,
          height: 300,
          fontSize: 16,
          fontWeight: "normal",
          color: "#000000",
          align: "left"
        }
      ]),
      backFields: "[]",
      category: "ID_CARD",
      sides: 1,
    }
  });
  console.log('Created Template:', template);
}

main().finally(() => prisma.$disconnect());
