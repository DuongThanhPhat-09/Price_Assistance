/**
 * Seeds the demo catalogue.
 *
 *   npm run db:seed            add any demo products that are missing
 *   tsx prisma/seed.ts --if-empty
 *                              only seed a completely empty database
 *                              (used by `vercel-build`; disable with
 *                              SEED_DEMO_DATA=false)
 *
 * Never updates or deletes existing rows, so prices you have edited are safe.
 */
import { PrismaClient } from "@prisma/client";
import { buildDemoProducts } from "./demo-products";

const prisma = new PrismaClient();

async function main() {
  const ifEmpty = process.argv.includes("--if-empty");

  if (ifEmpty) {
    if (process.env.SEED_DEMO_DATA === "false") {
      console.log("🌱 Seed skipped (SEED_DEMO_DATA=false).");
      return;
    }
    const existing = await prisma.product.count();
    if (existing > 0) {
      console.log(`🌱 Seed skipped: database already has ${existing} products.`);
      return;
    }
  }

  // One round trip; rows whose barcode already exists are left untouched.
  const { count } = await prisma.product.createMany({
    data: buildDemoProducts(),
    skipDuplicates: true,
  });
  const total = await prisma.product.count();
  console.log(`🌱 Seed complete: ${count} demo products added, ${total} products in database.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
