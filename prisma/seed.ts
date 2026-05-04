import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Default agent configuration
  const configs = [
    {
      key: "gig_description",
      value:
        "We're looking for a skilled full-stack developer to join our team for an exciting AI-powered product. You'll work on cutting-edge features involving LLMs, real-time data processing, and modern web technologies.",
    },
    { key: "budget_ceiling", value: "150" },
    { key: "tone", value: "professional yet friendly" },
    { key: "calendar_timezone", value: "America/New_York" },
    { key: "available_hours_start", value: "9" },
    { key: "available_hours_end", value: "17" },
    { key: "from_email", value: "agent@yourdomain.com" },
  ];

  for (const config of configs) {
    await prisma.agentConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: config,
    });
  }

  // Sample prospect for testing
  const prospect = await prisma.prospect.upsert({
    where: { email: "john@example.com" },
    update: {},
    create: {
      email: "john@example.com",
      name: "John Developer",
      company: "TechCorp",
      status: "NEW",
    },
  });

  console.log(`Created sample prospect: ${prospect.name}`);
  console.log("Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
