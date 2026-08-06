export type MetalTx = {
  type: string;
  date: string;
  grams: number;
  ratePerGram: number;
  totalAmount: number;
  realizedPL?: number | null;
};

export type MetalStats = {
  heldGrams: number;
  avgCostPerGram: number;
  totalCostBasis: number;
  realizedPL: number;
  currentValue: number | null;
  unrealizedPL: number | null;
};

export function computeMetalStats(
  transactions: MetalTx[],
  currentRate?: number | null,
): MetalStats {
  let heldGrams = 0;
  let totalCostBasis = 0;
  let realizedPL = 0;

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  for (const tx of sorted) {
    if (tx.type === "buy") {
      heldGrams += tx.grams;
      totalCostBasis += tx.totalAmount;
    } else {
      const avgCost = heldGrams > 0 ? totalCostBasis / heldGrams : 0;
      const pl = tx.grams * (tx.ratePerGram - avgCost);
      realizedPL += pl;
      totalCostBasis -= tx.grams * avgCost;
      heldGrams -= tx.grams;
    }
  }

  const avgCostPerGram = heldGrams > 0 ? totalCostBasis / heldGrams : 0;
  const currentValue =
    currentRate != null && currentRate > 0 ? heldGrams * currentRate : null;
  const unrealizedPL =
    currentValue != null && heldGrams > 0
      ? heldGrams * (currentRate! - avgCostPerGram)
      : null;

  return {
    heldGrams,
    avgCostPerGram,
    totalCostBasis,
    realizedPL,
    currentValue,
    unrealizedPL,
  };
}

export function computeSellPL(
  transactions: MetalTx[],
  sellGrams: number,
  sellRate: number,
): number {
  const stats = computeMetalStats(transactions);
  if (sellGrams <= 0 || sellGrams > stats.heldGrams + 0.0001) {
    return NaN;
  }
  return sellGrams * (sellRate - stats.avgCostPerGram);
}
