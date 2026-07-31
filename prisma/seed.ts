import "dotenv/config";
import bcrypt from "bcryptjs";
import path from "node:path";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateTotpSecret } from "../src/lib/totp";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("sslmode=")
      ? undefined
      : { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const email = process.env.SEED_EMAIL || "you@spendfolio.local";
  const password = process.env.SEED_PASSWORD || "Spendfolio1!";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Seed user already exists:", email);
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  const totpSecret = generateTotpSecret();
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      totpSecret,
      totpEnabled: true,
      incomes: {
        create: [
          {
            name: "Salary — Primary",
            amount: 82000,
            cadence: "Monthly",
            nextDate: "2026-08-01",
          },
          {
            name: "Freelance design",
            amount: 14500,
            cadence: "Variable",
            nextDate: "2026-08-12",
          },
          {
            name: "Interest (FD)",
            amount: 2100,
            cadence: "Monthly",
            nextDate: "2026-08-05",
          },
        ],
      },
      expenses: {
        create: [
          {
            date: "2026-07-28",
            label: "Domain renewal",
            amount: 1299,
            remarks: "bought nuthan.dev — next renewal 28 Jul 2027",
            renewalDate: "2027-07-28",
            monthKey: "2026-07",
          },
          {
            date: "2026-07-30",
            label: "Subscription",
            amount: 649,
            remarks: "Cursor Pro — renews monthly",
            renewalDate: "2026-08-02",
            monthKey: "2026-07",
          },
          {
            date: "2026-07-31",
            label: "Lunch",
            amount: 280,
            remarks: "Office cafeteria",
            monthKey: "2026-07",
          },
          {
            date: "2026-07-29",
            label: "Recharge",
            amount: 399,
            remarks: "Airtel prepaid",
            renewalDate: "2026-08-28",
            monthKey: "2026-07",
          },
          {
            date: "2026-07-27",
            label: "Groceries",
            amount: 2140,
            remarks: "Weekly stock",
            monthKey: "2026-07",
          },
          {
            date: "2026-07-25",
            label: "Utilities",
            amount: 1860,
            remarks: "Electricity bill — due soon",
            renewalDate: "2026-08-03",
            monthKey: "2026-07",
          },
          {
            date: "2026-07-24",
            label: "Breakfast",
            amount: 120,
            remarks: "",
            monthKey: "2026-07",
          },
          {
            date: "2026-07-22",
            label: "Transport",
            amount: 860,
            remarks: "Metro + auto",
            monthKey: "2026-07",
          },
        ],
      },
      fieldDefs: {
        create: [
          {
            label: "Payment mode",
            type: "dropdown",
            options: JSON.stringify(["UPI", "Card", "Cash", "Bank"]),
            sortOrder: 0,
          },
          {
            label: "Business expense",
            type: "checkbox",
            options: "[]",
            sortOrder: 1,
          },
        ],
      },
    },
  });

  console.log("Seeded user:", user.email);
  console.log("Password:", password);
  console.log("TOTP secret (add to authenticator):", totpSecret);

  const fs = await import("node:fs/promises");
  await fs.writeFile(
    path.join(process.cwd(), ".spendfolio-seed.txt"),
    [
      "Spendfolio seed credentials (gitignored)",
      `Email: ${email}`,
      `Password: ${password}`,
      `TOTP secret: ${totpSecret}`,
      "Add the TOTP secret to Google Authenticator / Authy as a manual entry (Spendfolio).",
      "",
    ].join("\n"),
    "utf8",
  );
  console.log("Wrote .spendfolio-seed.txt");

  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
