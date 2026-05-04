import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local for Prisma CLI commands
config({ path: resolve(process.cwd(), ".env.local") });
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
