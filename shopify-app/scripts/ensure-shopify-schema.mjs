import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "shopify"`);
console.log("schema shopify ready");
await prisma.$disconnect();
