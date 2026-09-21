import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseHouseDetails } from "@/lib/house";

export const runtime = "nodejs";

type ExportType = "expenses" | "gold" | "silver" | "house";

function parseCustomFields(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function appendSheet(workbook: XLSX.WorkBook, rows: Record<string, unknown>[], name: string) {
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name);
}

function toDownloadResponse(workbook: XLSX.WorkBook, filename: string) {
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as ExportType | null;

    if (!type || !["expenses", "gold", "silver", "house"].includes(type)) {
      return NextResponse.json({ ok: false, error: "Invalid export type." }, { status: 400 });
    }

    const workbook = XLSX.utils.book_new();
    const today = new Date().toISOString().slice(0, 10);

    if (type === "expenses") {
      const scope = searchParams.get("scope") === "month" ? "month" : "whole";
      const month = searchParams.get("month");
      if (scope === "month" && !/^\d{4}-\d{2}$/.test(month || "")) {
        return NextResponse.json({ ok: false, error: "Select a valid expense month." }, { status: 400 });
      }

      const [expenses, fields] = await Promise.all([
        prisma.expense.findMany({
          where: { userId: user.id, ...(scope === "month" ? { monthKey: month! } : {}) },
          orderBy: [{ monthKey: "asc" }, { date: "asc" }, { createdAt: "asc" }],
        }),
        prisma.customFieldDef.findMany({ where: { userId: user.id }, orderBy: { sortOrder: "asc" } }),
      ]);

      const makeRows = (rows: typeof expenses) =>
        rows.length > 0
          ? rows.map((expense) => {
              const customValues = parseCustomFields(expense.customFields);
              const row: Record<string, unknown> = {
                Date: expense.date,
                Description: expense.label,
                Amount: expense.amount,
                Remarks: expense.remarks,
                Recurring: expense.recurring ? "Yes" : "No",
                RenewalDate: expense.renewalDate || "",
                Month: expense.monthKey,
                CreatedAt: expense.createdAt.toISOString(),
                UpdatedAt: expense.updatedAt.toISOString(),
              };
              for (const field of fields) {
                row[`Custom: ${field.label}`] = customValues[field.id] ?? customValues[field.label] ?? "";
              }
              return row;
            })
          : [
              Object.fromEntries([
                ["Date", ""],
                ["Description", ""],
                ["Amount", ""],
                ["Remarks", ""],
                ["Recurring", ""],
                ["RenewalDate", ""],
                ["Month", ""],
                ["CreatedAt", ""],
                ["UpdatedAt", ""],
                ...fields.map((field) => [`Custom: ${field.label}`, ""]),
              ]),
            ];

      if (scope === "month") {
        appendSheet(workbook, makeRows(expenses), month!);
      } else {
        const expensesByMonth = Map.groupBy(expenses, (expense) => expense.monthKey);
        if (expensesByMonth.size === 0) appendSheet(workbook, makeRows([]), "Expenses");
        for (const [monthKey, rows] of expensesByMonth) appendSheet(workbook, makeRows(rows), monthKey);
      }

      return toDownloadResponse(workbook, `spendfolio-expenses-${scope === "month" ? month : "whole"}-${today}.xlsx`);
    }

    if (type === "gold" || type === "silver") {
      const [holding, transactions] = await Promise.all([
        prisma.metalHolding.findFirst({ where: { userId: user.id, metalType: type } }),
        prisma.metalTransaction.findMany({ where: { userId: user.id, metalType: type }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
      ]);

      appendSheet(workbook, [
        {
          Metal: type,
          GoalGrams: holding?.goalGrams ?? "",
          GoalDate: holding?.goalDate ?? "",
          CurrentRate: holding?.currentRate ?? "",
          Notes: holding?.notes ?? "",
          UpdatedAt: holding?.updatedAt.toISOString() ?? "",
        },
      ], "Holding");
      appendSheet(
        workbook,
        transactions.length > 0
          ? transactions.map((transaction) => ({
              Date: transaction.date,
              Type: transaction.type,
              ItemType: transaction.itemType,
              Purity: transaction.purity,
              Quantity: transaction.quantity,
              Grams: transaction.grams,
              RatePerGram: transaction.ratePerGram,
              MetalValue: transaction.goldValue,
              MakingCharge: transaction.makingCharge,
              GstType: transaction.gstType,
              GstAmount: transaction.gstAmount,
              IgstAmount: transaction.igstAmount,
              SgstAmount: transaction.sgstAmount,
              AdditionalAmount: transaction.additionalAmount,
              DiscountPercent: transaction.discountPercent,
              TotalAmount: transaction.totalAmount,
              RealizedPL: transaction.realizedPL ?? "",
              Note: transaction.note,
              CreatedAt: transaction.createdAt.toISOString(),
              UpdatedAt: transaction.updatedAt.toISOString(),
            }))
          : [{ Date: "", Type: "", Grams: "", TotalAmount: "" }],
        "Transactions",
      );
      return toDownloadResponse(workbook, `spendfolio-${type}-${today}.xlsx`);
    }

    const [profiles, expenses] = await Promise.all([
      prisma.houseProfile.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
      prisma.houseExpense.findMany({ where: { userId: user.id }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    ]);
    const nameById = new Map(profiles.map((profile) => [profile.id, profile.name]));
    appendSheet(
      workbook,
      profiles.length > 0
        ? profiles.map((profile) => {
            const details = parseHouseDetails(profile.loanDetails);
            return {
              Property: profile.name,
              Type: profile.propertyType,
              Address: profile.address,
              PurchaseDate: profile.purchaseDate ?? "",
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
        : [{ Property: "", Type: "", Address: "" }],
      "Profile",
    );
    const contactRows = profiles.flatMap((profile) => {
      const details = parseHouseDetails(profile.loanDetails);
      return details.contacts.length > 0
        ? details.contacts.map((contact) => ({
            Property: profile.name,
            Role: contact.department,
            Person: contact.person,
            Phone: contact.phone,
            Email: contact.email,
            Notes: contact.notes,
          }))
        : [{ Property: profile.name, Role: "", Person: "", Phone: "", Email: "", Notes: "" }];
    });
    appendSheet(workbook, contactRows.length > 0 ? contactRows : [{ Property: "", Role: "" }], "Contacts");
    appendSheet(
      workbook,
      expenses.length > 0
        ? expenses.map((expense) => ({
            Property: nameById.get(expense.houseId) || "",
            Date: expense.date,
            Month: expense.monthKey || expense.date.slice(0, 7),
            Kind: expense.kind,
            Category: expense.category,
            CustomLabel: expense.customLabel,
            Amount: expense.amount,
            Recurring: expense.recurring ? "Yes" : "No",
            Note: expense.note,
            CreatedAt: expense.createdAt.toISOString(),
            UpdatedAt: expense.updatedAt.toISOString(),
          }))
        : [{ Property: "", Date: "", Category: "", Amount: "" }],
      "Expenses",
    );
    return toDownloadResponse(workbook, `spendfolio-house-${today}.xlsx`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}