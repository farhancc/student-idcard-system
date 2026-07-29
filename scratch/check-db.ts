import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.cardTemplate.findMany({
    orderBy: { id: 'desc' }
  });
  console.log('Templates Count:', templates.length);
  for (const t of templates) {
    console.log(`- ID: ${t.id}, Name: "${t.name}", PressID: ${t.pressId}, Version: ${t.version}, isLatest: ${t.isLatest}`);
    const fields = await prisma.templateField.findMany({
      where: { templateId: t.id }
    });
    console.log(`  TemplateFields count: ${fields.length}`);
    for (const f of fields) {
      console.log(`    * Field: "${f.field}", Type: "${f.type}", Side: "${f.side}", Suffix: "${f.suffix}"`);
    }
  }
}

main().finally(() => prisma.$disconnect());
