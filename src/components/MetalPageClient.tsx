"use client";

import { useState } from "react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import {
  buyMetal,
  sellMetal,
  setMetalGoal,
  updateCurrentRate,
  deleteMetalTransaction,
  type MetalHoldingData,
  type MetalTransactionData,
  type MetalType,
} from "@/lib/actions/metal";

export function MetalPageClient({
  metalType,
  initialHolding,
  initialTransactions,
}: {
  metalType: MetalType;
  initialHolding: MetalHoldingData;
  initialTransactions: MetalTransactionData[];
}) {
  const [holding, setHolding] = useState(initialHolding);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Tabs: overview, add-transaction, set-goal
  const [tab, setTab] = useState<"overview" | "buy" | "sell" | "goal" | "rate">("overview");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatGrams = (grams: number) => {
    return grams.toFixed(2);
  };

  const capitalLabel = metalType === "gold" ? "Gold" : "Silver";

  // Buy handler
  const handleBuy = async (formData: FormData) => {
    setLoading(true);
    setError("");
    const date = formData.get("date") as string;
    const grams = parseFloat(formData.get("grams") as string);
    const rate = parseFloat(formData.get("rate") as string);
    const note = formData.get("note") as string;

    const result = await buyMetal(metalType, date, grams, rate, note);
    if ("error" in result) {
      setError(result.error);
    } else {
      setTab("overview");
      // Refresh would be better but we'll simulate
      setHolding((prev) => ({
        ...prev,
        totalGrams: prev.totalGrams + grams,
        currentValue: (prev.totalGrams + grams) * (prev.currentRate || rate),
      }));
      setTransactions((prev) => [
        {
          id: `temp-${Date.now()}`,
          date,
          type: "buy",
          grams,
          ratePerGram: rate,
          totalAmount: grams * rate,
          note,
          realizedPL: null,
        },
        ...prev,
      ]);
    }
    setLoading(false);
  };

  // Sell handler
  const handleSell = async (formData: FormData) => {
    setLoading(true);
    setError("");
    const date = formData.get("date") as string;
    const grams = parseFloat(formData.get("grams") as string);
    const rate = parseFloat(formData.get("rate") as string);
    const note = formData.get("note") as string;

    const result = await sellMetal(metalType, date, grams, rate, note);
    if ("error" in result) {
      setError(result.error);
    } else {
      setTab("overview");
      const totalAmount = grams * rate;
      const costOfSold = grams * holding.averageCostPerGram;
      const realizedPL = totalAmount - costOfSold;

      setHolding((prev) => ({
        ...prev,
        totalGrams: Math.max(0, prev.totalGrams - grams),
        currentValue: Math.max(0, prev.totalGrams - grams) * (prev.currentRate || rate),
      }));
      setTransactions((prev) => [
        {
          id: `temp-${Date.now()}`,
          date,
          type: "sell",
          grams,
          ratePerGram: rate,
          totalAmount,
          note,
          realizedPL,
        },
        ...prev,
      ]);
    }
    setLoading(false);
  };

  // Set goal handler
  const handleSetGoal = async (formData: FormData) => {
    setLoading(true);
    setError("");
    const goalGrams = formData.get("goalGrams")
      ? parseFloat(formData.get("goalGrams") as string)
      : null;
    const goalDate = (formData.get("goalDate") as string) || null;
    const notes = (formData.get("notes") as string) || "";

    const result = await setMetalGoal(metalType, goalGrams, goalDate, notes);
    if ("error" in result) {
      setError(result.error);
    } else {
      setTab("overview");
      setHolding((prev) => ({
        ...prev,
        goalGrams,
        goalDate,
        notes,
        progressPercent: goalGrams ? (prev.totalGrams / goalGrams) * 100 : 0,
      }));
    }
    setLoading(false);
  };

  // Update rate handler
  const handleUpdateRate = async (formData: FormData) => {
    setLoading(true);
    setError("");
    const rate = parseFloat(formData.get("rate") as string);

    const result = await updateCurrentRate(metalType, rate);
    if ("error" in result) {
      setError(result.error);
    } else {
      setTab("overview");
      setHolding((prev) => ({
        ...prev,
        currentRate: rate,
        currentValue: prev.totalGrams * rate,
      }));
    }
    setLoading(false);
  };

  // Delete transaction
  const handleDeleteTransaction = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    setLoading(true);
    const result = await deleteMetalTransaction(id, metalType);
    if ("error" in result) {
      setError(result.error);
    } else {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    }
    setLoading(false);
  };

  const plColor = (pl: number) => (pl >= 0 ? "text-green-600" : "text-red-600");
  const plIcon = (pl: number) => (pl >= 0 ? "↑" : "↓");

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Holding */}
        <div className="rounded-lg border border-line/60 bg-white/40 p-4 backdrop-blur-sm">
          <div className="text-xs font-medium text-ink-soft">Total {capitalLabel}</div>
          <div className="mt-1 text-2xl font-bold text-ink">
            {formatGrams(holding.totalGrams)}g
          </div>
          <div className="mt-2 text-xs text-ink-soft">Avg cost: {formatCurrency(holding.averageCostPerGram)}/g</div>
        </div>

        {/* Current Value */}
        <div className="rounded-lg border border-line/60 bg-white/40 p-4 backdrop-blur-sm">
          <div className="text-xs font-medium text-ink-soft">Current Value</div>
          <div className="mt-1 text-2xl font-bold text-ink">
            <AnimatedNumber value={holding.currentValue} format={formatCurrency} />
          </div>
          <div className="mt-2 text-xs text-ink-soft">
            @ {formatCurrency(holding.currentRate || 0)}/g
          </div>
        </div>

        {/* Goal Progress */}
        {holding.goalGrams ? (
          <div className="rounded-lg border border-line/60 bg-white/40 p-4 backdrop-blur-sm">
            <div className="text-xs font-medium text-ink-soft">Goal Progress</div>
            <div className="mt-1 text-2xl font-bold text-ink">
              {holding.progressPercent.toFixed(0)}%
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line/30">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-300"
                style={{ width: `${Math.min(100, holding.progressPercent)}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-ink-soft">
              {formatGrams(holding.totalGrams)} / {formatGrams(holding.goalGrams)}g
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-line/60 bg-white/40 p-4 backdrop-blur-sm">
            <div className="text-xs font-medium text-ink-soft">Goal</div>
            <div className="mt-1 text-lg font-semibold text-ink-soft">Not set</div>
            <button
              onClick={() => setTab("goal")}
              className="mt-3 text-xs text-amber-600 hover:text-amber-700"
            >
              Set goal →
            </button>
          </div>
        )}

        {/* Total Investment */}
        <div className="rounded-lg border border-line/60 bg-white/40 p-4 backdrop-blur-sm">
          <div className="text-xs font-medium text-ink-soft">Total Investment</div>
          <div className="mt-1 text-2xl font-bold text-ink">
            {formatCurrency(holding.totalGrams * holding.averageCostPerGram)}
          </div>
          <div className="mt-2 text-xs text-ink-soft">
            Unrealized gain:{" "}
            {formatCurrency(holding.currentValue - holding.totalGrams * holding.averageCostPerGram)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-line/60">
        <div className="flex gap-2">
          {(
            [
              { id: "overview", label: "Overview" },
              { id: "buy", label: "Buy" },
              { id: "sell", label: "Sell" },
              { id: "rate", label: "Set Rate" },
              { id: "goal", label: "Goal" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setError("");
              }}
              data-active={tab === t.id}
              className="px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink data-[active=true]:border-b-2 data-[active=true]:border-amber-500 data-[active=true]:text-ink"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {/* Overview Tab */}
        {tab === "overview" && (
          <div>
            {holding.notes && (
              <div className="mb-4 rounded-lg border border-line/60 bg-white/40 p-4 backdrop-blur-sm">
                <div className="text-xs font-medium text-ink-soft mb-1">Notes</div>
                <div className="text-sm text-ink">{holding.notes}</div>
              </div>
            )}

            <div>
              <h3 className="mb-3 text-sm font-semibold text-ink">Transaction History</h3>
              {transactions.length === 0 ? (
                <div className="rounded-lg border border-line/60 bg-white/40 p-8 text-center backdrop-blur-sm">
                  <div className="text-sm text-ink-soft">No transactions yet</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between rounded-lg border border-line/60 bg-white/40 p-3 backdrop-blur-sm hover:bg-white/50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                              tx.type === "buy"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {tx.type === "buy" ? "Buy" : "Sell"}
                          </span>
                          <span className="text-sm font-medium text-ink">
                            {formatGrams(tx.grams)}g @ {formatCurrency(tx.ratePerGram)}/g
                          </span>
                          <span className="text-xs text-ink-soft">{tx.date}</span>
                        </div>
                        {tx.note && (
                          <div className="mt-1 text-xs text-ink-soft">{tx.note}</div>
                        )}
                        {tx.realizedPL !== null && (
                          <div className={`mt-1 text-xs font-medium ${plColor(tx.realizedPL)}`}>
                            {plIcon(tx.realizedPL)} P&L: {formatCurrency(Math.abs(tx.realizedPL))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-semibold text-ink">
                            {formatCurrency(tx.totalAmount)}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="text-xs text-ink-soft hover:text-red-600"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Buy Tab */}
        {tab === "buy" && (
          <form action={handleBuy} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Date</label>
              <input
                type="date"
                name="date"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
                className="w-full rounded border border-line/60 bg-white/40 px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1">Grams</label>
                <input
                  type="number"
                  name="grams"
                  step="any"
                  placeholder="10.5"
                  required
                  className="w-full rounded border border-line/60 bg-white/40 px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1">
                  Rate (₹/gram)
                </label>
                <input
                  type="number"
                  name="rate"
                  step="any"
                  placeholder="5000"
                  required
                  className="w-full rounded border border-line/60 bg-white/40 px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Note</label>
              <input
                type="text"
                name="note"
                placeholder="e.g., Purchased from jeweler"
                className="w-full rounded border border-line/60 bg-white/40 px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </div>
            {error && <div className="rounded bg-red-100 p-2 text-xs text-red-700">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add Purchase"}
            </button>
          </form>
        )}

        {/* Sell Tab */}
        {tab === "sell" && (
          <form action={handleSell} className="space-y-3">
            <div className="rounded-lg border border-line/60 bg-white/40 p-3 backdrop-blur-sm">
              <div className="text-xs text-ink-soft">Available to sell</div>
              <div className="text-lg font-bold text-ink">{formatGrams(holding.totalGrams)}g</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Date</label>
              <input
                type="date"
                name="date"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
                className="w-full rounded border border-line/60 bg-white/40 px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1">Grams</label>
                <input
                  type="number"
                  name="grams"
                  step="any"
                  placeholder="5.5"
                  required
                  className="w-full rounded border border-line/60 bg-white/40 px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1">
                  Rate (₹/gram)
                </label>
                <input
                  type="number"
                  name="rate"
                  step="any"
                  placeholder="5200"
                  required
                  className="w-full rounded border border-line/60 bg-white/40 px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Note</label>
              <input
                type="text"
                name="note"
                placeholder="e.g., Sold to jeweler"
                className="w-full rounded border border-line/60 bg-white/40 px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </div>
            {error && <div className="rounded bg-red-100 p-2 text-xs text-red-700">{error}</div>}
            <button
              type="submit"
              disabled={loading || holding.totalGrams === 0}
              className="w-full rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Selling..." : "Sell"}
            </button>
          </form>
        )}

        {/* Set Rate Tab */}
        {tab === "rate" && (
          <form action={handleUpdateRate} className="space-y-3">
            <div className="rounded-lg border border-line/60 bg-white/40 p-3 backdrop-blur-sm">
              <div className="text-xs text-ink-soft">Current market rate</div>
              <div className="text-lg font-bold text-ink">
                {formatCurrency(holding.currentRate || 0)}/gram
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">
                New Rate (₹/gram)
              </label>
              <input
                type="number"
                name="rate"
                step="any"
                defaultValue={holding.currentRate || ""}
                placeholder="5000"
                required
                className="w-full rounded border border-line/60 bg-white/40 px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </div>
            {error && <div className="rounded bg-red-100 p-2 text-xs text-red-700">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update Rate"}
            </button>
          </form>
        )}

        {/* Goal Tab */}
        {tab === "goal" && (
          <form action={handleSetGoal} className="space-y-3">
            {holding.goalGrams && (
              <div className="rounded-lg border border-line/60 bg-white/40 p-3 backdrop-blur-sm">
                <div className="text-xs text-ink-soft">Current goal</div>
                <div className="text-lg font-bold text-ink">
                  {formatGrams(holding.goalGrams)}g
                  {holding.goalDate && ` by ${holding.goalDate}`}
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Goal (grams)</label>
              <input
                type="number"
                name="goalGrams"
                step="any"
                defaultValue={holding.goalGrams || ""}
                placeholder="100"
                className="w-full rounded border border-line/60 bg-white/40 px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Target Date</label>
              <input
                type="date"
                name="goalDate"
                defaultValue={holding.goalDate || ""}
                className="w-full rounded border border-line/60 bg-white/40 px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Notes</label>
              <textarea
                name="notes"
                defaultValue={holding.notes}
                placeholder="Why are you accumulating gold?"
                rows={3}
                className="w-full rounded border border-line/60 bg-white/40 px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </div>
            {error && <div className="rounded bg-red-100 p-2 text-xs text-red-700">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Goal"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
