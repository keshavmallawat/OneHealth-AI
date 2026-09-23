import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const record = await prisma.healthRecord.findFirst({
    where: { status: 'DONE' }
  });
  console.log(JSON.stringify(record, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
