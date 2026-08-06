import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseHouseDetails } from "@/lib/house";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();

    let profile = await prisma.houseProfile.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    if (!profile) {
      profile = await prisma.houseProfile.create({
        data: {
          userId: user.id,
          name: "Main residence",
          address: "",
          purchaseDate: null,
          purchasePrice: null,
          loanDetails: "{}",
        },
      });
    }

    const details = parseHouseDetails(profile.loanDetails);
    const expenses = await prisma.houseExpense.findMany({
      where: { userId: user.id, houseId: profile.id },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });

    const categoryMap = new Map<string, number>();
    const monthMap = new Map<string, number>();

    for (const row of expenses) {
      categoryMap.set(row.category, (categoryMap.get(row.category) || 0) + row.amount);
      const monthKey = row.date.slice(0, 7);
      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + row.amount);
    }

    const workbook = XLSX.utils.book_new();

    const overviewRows = [
      {
        Name: profile.name,
        Address: profile.address,
        PurchaseDate: profile.purchaseDate || "",
        PurchasePrice: profile.purchasePrice ?? "",
        DownPaymentTarget: details.downPaymentTarget ?? "",
        DownPaymentPaid: details.downPaymentPaid ?? "",
        RaisedRequestPayments: details.raisedRequestPayments ?? "",
        ModificationAmount: details.modificationAmount ?? "",
        TDS: details.tdsAmount ?? "",
        Corpus: details.corpusAmount ?? "",
        RegistrationCost: details.registrationCost ?? "",
        StampDuty: details.stampDuty ?? "",
        LoanSanctionedAmount: details.loanSanctionedAmount ?? "",
        LoanOutstandingAmount: details.loanOutstandingAmount ?? "",
        OutstandingEmiMonths: details.outstandingEmiMonths ?? "",
      },
    ];

    const contactRows =
      details.contacts.length > 0
        ? details.contacts.map((contact) => ({
            Department: contact.department,
            Person: contact.person,
            Phone: contact.phone,
            Email: contact.email,
            Notes: contact.notes,
          }))
        : [{ Department: "", Person: "", Phone: "", Email: "", Notes: "" }];

    const expenseRows =
      expenses.length > 0
        ? expenses.map((row) => ({
            Date: row.date,
            Category: row.category,
            Amount: row.amount,
            Recurring: row.recurring ? "Yes" : "No",
            Note: row.note,
          }))
        : [{ Date: "", Category: "", Amount: "", Recurring: "", Note: "" }];

    const categoryRows =
      categoryMap.size > 0
        ? [...categoryMap.entries()]
            .map(([category, total]) => ({ Category: category, Total: total }))
            .sort((a, b) => b.Total - a.Total)
        : [{ Category: "", Total: "" }];

    const monthRows =
      monthMap.size > 0
        ? [...monthMap.entries()]
            .map(([monthKey, total]) => ({ Month: monthKey, Total: total }))
            .sort((a, b) => b.Month.localeCompare(a.Month))
        : [{ Month: "", Total: "" }];

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(overviewRows), "Overview");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(contactRows), "Contacts");
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
