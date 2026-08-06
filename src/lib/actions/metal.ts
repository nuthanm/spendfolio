"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export type MetalType = "gold" | "silver";

export interface MetalHoldingData {
  metalType: MetalType;
  totalGrams: number;
  goalGrams: number | null;
  goalDate: string | null;
  currentRate: number | null;
  notes: string;
  averageCostPerGram: number;
  currentValue: number;
  progressPercent: number;
}

export interface MetalTransactionData {
  id: string;
  date: string;
  type: "buy" | "sell";
  grams: number;
  ratePerGram: number;
  totalAmount: number;
  note: string;
  realizedPL: number | null;
}

// Get or create metal holding for user
async function getOrCreateHolding(userId: string, metalType: MetalType) {
  let holding = await prisma.metalHolding.findUnique({
    where: {
      userId_metalType: {
        userId,
        metalType,
      },
    },
  });

  if (!holding) {
    holding = await prisma.metalHolding.create({
      data: {
        userId,
        metalType,
        goalGrams: null,
        goalDate: null,
        currentRate: null,
        notes: "",
      },
    });
  }

  return holding;
}

// Calculate accumulated grams and average cost
async function calculateAccumulation(userId: string, metalType: MetalType) {
  const transactions = await prisma.metalTransaction.findMany({
    where: {
      userId,
      metalType,
    },
    orderBy: { date: "asc" },
  });

  let totalGrams = 0;
  let totalCost = 0;

  for (const tx of transactions) {
    if (tx.type === "buy") {
      totalGrams += tx.grams;
      totalCost += tx.totalAmount;
    } else if (tx.type === "sell") {
      totalGrams -= tx.grams;
      // Reduce cost proportionally
      if (totalGrams > 0) {
        const avgCost = totalCost / (totalGrams + tx.grams);
        totalCost -= tx.grams * avgCost;
      }
    }
  }

  return {
    totalGrams: Math.max(0, totalGrams),
    averageCostPerGram: totalGrams > 0 ? totalCost / totalGrams : 0,
    totalCost: Math.max(0, totalCost),
  };
}

export async function getMetalHolding(metalType: MetalType): Promise<MetalHoldingData> {
  const user = await requireUser();
  const holding = await getOrCreateHolding(user.id, metalType);

  const { totalGrams, averageCostPerGram, totalCost } = await calculateAccumulation(
    user.id,
    metalType,
  );

  const currentValue = totalGrams * (holding.currentRate || 0);
  const progressPercent = holding.goalGrams ? (totalGrams / holding.goalGrams) * 100 : 0;

  return {
    metalType,
    totalGrams,
    goalGrams: holding.goalGrams,
    goalDate: holding.goalDate,
    currentRate: holding.currentRate,
    notes: holding.notes,
    averageCostPerGram,
    currentValue,
    progressPercent: Math.min(100, progressPercent),
  };
}

export async function getMetalTransactions(metalType: MetalType): Promise<MetalTransactionData[]> {
  const user = await requireUser();

  const transactions = await prisma.metalTransaction.findMany({
    where: {
      userId: user.id,
      metalType,
    },
    orderBy: { date: "desc" },
  });

  return transactions.map((tx) => ({
    id: tx.id,
    date: tx.date,
    type: tx.type as "buy" | "sell",
    grams: tx.grams,
    ratePerGram: tx.ratePerGram,
    totalAmount: tx.totalAmount,
    note: tx.note,
    realizedPL: tx.realizedPL,
  }));
}

export async function buyMetal(
  metalType: MetalType,
  date: string,
  grams: number,
  ratePerGram: number,
  note: string,
) {
  const user = await requireUser();

  if (grams <= 0 || ratePerGram <= 0) {
    return { error: "Grams and rate must be positive" };
  }

  const totalAmount = grams * ratePerGram;

  await prisma.metalTransaction.create({
    data: {
      userId: user.id,
      metalType,
      type: "buy",
      date,
      grams,
      ratePerGram,
      totalAmount,
      note,
    },
  });

  revalidatePath(`/${metalType}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function sellMetal(
  metalType: MetalType,
  date: string,
  grams: number,
  ratePerGram: number,
  note: string,
) {
  const user = await requireUser();

  if (grams <= 0 || ratePerGram <= 0) {
    return { error: "Grams and rate must be positive" };
  }

  const { totalGrams, averageCostPerGram } = await calculateAccumulation(
    user.id,
    metalType,
  );

  if (grams > totalGrams) {
    return { error: `Cannot sell ${grams}g. You only have ${totalGrams}g.` };
  }

  const totalAmount = grams * ratePerGram;
  const costOfSold = grams * averageCostPerGram;
  const realizedPL = totalAmount - costOfSold;

  await prisma.metalTransaction.create({
    data: {
      userId: user.id,
      metalType,
      type: "sell",
      date,
      grams,
      ratePerGram,
      totalAmount,
      note,
      realizedPL,
    },
  });

  revalidatePath(`/${metalType}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function setMetalGoal(
  metalType: MetalType,
  goalGrams: number | null,
  goalDate: string | null,
  notes: string,
) {
  const user = await requireUser();

  if (goalGrams !== null && goalGrams <= 0) {
    return { error: "Goal grams must be positive" };
  }

  const holding = await getOrCreateHolding(user.id, metalType);

  await prisma.metalHolding.update({
    where: { id: holding.id },
    data: {
      goalGrams,
      goalDate,
      notes,
    },
  });

  revalidatePath(`/${metalType}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function updateCurrentRate(metalType: MetalType, rate: number) {
  const user = await requireUser();

  if (rate < 0) {
    return { error: "Rate cannot be negative" };
  }

  const holding = await getOrCreateHolding(user.id, metalType);

  await prisma.metalHolding.update({
    where: { id: holding.id },
    data: { currentRate: rate },
  });

  revalidatePath(`/${metalType}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function deleteMetalTransaction(id: string, metalType: MetalType) {
  const user = await requireUser();

  const tx = await prisma.metalTransaction.findUnique({
    where: { id },
  });

  if (!tx || tx.userId !== user.id) {
    return { error: "Transaction not found" };
  }

  await prisma.metalTransaction.delete({
    where: { id },
  });

  revalidatePath(`/${metalType}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}
