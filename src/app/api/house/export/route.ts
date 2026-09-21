import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseHouseDetails } from "@/lib/house";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();

    const [profiles, expenses] = await Promise.all([
      prisma.houseProfile.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      }),
      prisma.houseExpense.findMany({
        where: { userId: user.id },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
    ]);

    const nameById = new Map(profiles.map((profile) => [profile.id, profile.name]));
    const workbook = XLSX.utils.book_new();

    const overviewRows =
      profiles.length > 0
        ? profiles.map((profile) => {
            const details = parseHouseDetails(profile.loanDetails);
            return {
              Property: profile.name,
              Type: profile.propertyType,
              Address: profile.address,
              PurchaseDate: profile.purchaseDate || "",
              PurchasePrice: profile.purchasePrice ?? "",
              CarpetArea: profile.carpetArea ?? "",
              BuiltupArea: profile.builtupArea ?? "",
              SuperBuiltupArea: profile.superBuiltupArea ?? "",
              LandArea: profile.landArea ?? "",
              UdsPercent: profile.udsPercent ?? "",
              MonthlyBudget: profile.monthlyBudget ?? "",
              TdsApplicable: profile.tdsApplicable ? "Yes" : "No",
              DownPaymentTarget: details.downPaymentTarget ?? "",
              DownPaymentPercent: details.downPaymentPercent ?? "",
              CorpusTarget: details.corpusTarget ?? "",
              TdsTarget: details.tdsTarget ?? "",
              RegistrationTarget: details.registrationTarget ?? "",
              StampDutyTarget: details.stampDutyTarget ?? "",
              LoanBank: details.loan.bank,
              LoanSanctionedAmount: details.loan.sanctionedAmount ?? "",
              LoanTenureMonths: details.loan.tenureMonths ?? "",
              LoanInterestRate: details.loan.interestRate ?? "",
              LoanOutstandingAmount: details.loan.outstandingAmount ?? "",
              OutstandingEmiMonths: details.loan.outstandingEmiMonths ?? "",
            };
          })
        : [{ Property: "", Type: "", Address: "" }];

    const contactRows = profiles.flatMap((profile) => {
      const details = parseHouseDetails(profile.loanDetails);
      if (details.contacts.length === 0) {
        return [{ Property: profile.name, Role: "", Person: "", Phone: "", Email: "", Notes: "" }];
      }
      return details.contacts.map((contact) => ({
        Property: profile.name,
        Role: contact.department,
        Person: contact.person,
        Phone: contact.phone,
        Email: contact.email,
        Notes: contact.notes,
      }));
    });

    const expenseRows =
      expenses.length > 0
        ? expenses.map((row) => ({
            Property: nameById.get(row.houseId) || "",
            Date: row.date,
            Month: row.monthKey || row.date.slice(0, 7),
            Kind: row.kind,
            Category: row.category,
            CustomLabel: row.customLabel,
            Amount: row.amount,
            Recurring: row.recurring ? "Yes" : "No",
            Note: row.note,
          }))
        : [{ Property: "", Date: "", Category: "", Amount: "" }];

    const categoryMap = new Map<string, number>();
    const monthMap = new Map<string, number>();
    for (const row of expenses) {
      const property = nameById.get(row.houseId) || "";
      const categoryKey = `${property} · ${row.kind} · ${row.category}`;
      const monthKey = `${property} · ${row.monthKey || row.date.slice(0, 7)}`;
      categoryMap.set(categoryKey, (categoryMap.get(categoryKey) || 0) + row.amount);
      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + row.amount);
    }

    const categoryRows =
      categoryMap.size > 0
        ? [...categoryMap.entries()]
            .map(([category, total]) => ({ Category: category, Total: total }))
            .sort((a, b) => b.Total - a.Total)
        : [{ Category: "", Total: "" }];

    const monthRows =
      monthMap.size > 0
        ? [...monthMap.entries()]
            .map(([month, total]) => ({ Month: month, Total: total }))
            .sort((a, b) => b.Month.localeCompare(a.Month))
        : [{ Month: "", Total: "" }];

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(overviewRows), "Overview");
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(contactRows.length > 0 ? contactRows : [{ Property: "", Role: "" }]),
      "Contacts",
    );
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(expenseRows), "Entries");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(categoryRows), "CategoryTotals");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(monthRows), "MonthlyTotals");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const today = new Date().toISOString().slice(0, 10);
    const filename = `house-tracker-${today}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
