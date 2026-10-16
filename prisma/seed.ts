/**
 * Seeds the demo catalogue. Safe to run repeatedly: products are upserted
 * by barcode, so it never creates duplicates and never deletes your data.
 *
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { buildDemoProducts } from "./demo-products";

const prisma = new PrismaClient();

async function main() {
  const products = buildDemoProducts();
  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const p of products) {
      const existing = await tx.product.findUnique({ where: { barcode: p.barcode }, select: { id: true } });
      if (existing) {
        await tx.product.update({ where: { id: existing.id }, data: p });
        updated++;
      } else {
        await tx.product.create({ data: p });
        created++;
      }
    }
  });

  const total = await prisma.product.count();
  console.log(`🌱 Seed complete: ${created} created, ${updated} updated, ${total} products in database.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
