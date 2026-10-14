import { currentMonthKey, formatMonthLabel, formatMonthShortLabel } from "@/lib/dates";
import { formatINR } from "@/lib/finance";

export type OutflowBucketId = "obligations" | "card" | "aside" | "living";

export const OUTFLOW_BUCKETS: { id: OutflowBucketId; name: string; sentence: string }[] = [
  { id: "obligations", name: "Loans and chits", sentence: "loans and chits" },
  { id: "card", name: "Card payments", sentence: "card payments" },
  { id: "aside", name: "Savings and insurance", sentence: "savings and insurance" },
  { id: "living", name: "Living", sentence: "living" },
];

export type OutflowCategory = {
  id: string;
  name: string;
  bucket: OutflowBucketId;
  amount: number;
  txns: number;
};

export type OutflowMonth = {
  key: string;
  shortLabel: string;
  axisLabel: string;
  partial: boolean;
  total: number;
  living: number;
  buckets: Record<OutflowBucketId, number>;
  categories: { id: string; amount: number }[];
};

export type OutflowAnalysis = {
  total: number;
  txns: number;
  livingTotal: number;
  livingTxns: number;
  buckets: { id: OutflowBucketId; name: string; amount: number; txns: number }[];
  categories: OutflowCategory[];
  months: OutflowMonth[];
  headline: string;
  notes: string[];
};

type ExpenseRow = { monthKey: string; amount: number; label: string };

const RULES: { bucket: OutflowBucketId; category: string; pattern: RegExp }[] = [
  {
    bucket: "card",
    category: "Bank and CC fees",
    pattern: /super cash|loan recovery|swipe charge|\bcc charge|^charges$|renew\w* fee/i,
  },
  { bucket: "card", category: "CC liquidity swipes", pattern: /swipe|liquidity/i },
  { bucket: "obligations", category: "Chit funds and kitti", pattern: /chit|kitti|kitty|chitty|\bdip\b/i },
  { bucket: "aside", category: "Savings, investments and gold", pattern: /post\s?office|\bpo\b/i },
  {
    bucket: "obligations",
    category: "Loans, EMIs and interest",
    pattern:
      /interest|intrest|\bloans?\b|\bemis?\b|\bpl\b|kreditbee|debt|gold loan|\bgl\b|\bcl\b|teju mama|^varalu$|dinesh varalu|nagaraj|rama aunty|^siva -|^shiva |siva uncle|^rajesh friend$|raj payment/i,
  },
  { bucket: "card", category: "Credit card bill settlements", pattern: /\bcc\b|credit card|card bill|card settlement/i },
  { bucket: "aside", category: "Insurance and LIC premiums", pattern: /\blic\b|insurance/i },
  {
    bucket: "aside",
    category: "Savings, investments and gold",
    pattern:
      /saving|gold|tanishq|goldbees|gold bees|\brd\b|\bapy\b|zerodha|mutual|\bmf\b|investment|demat|\bsip\b|\bfd\b|fixed deposit|\bsilver\b|scheme/i,
  },
  {
    bucket: "living",
    category: "Healthcare and medical",
    pattern:
      /health|medical|medicen|medicine|medicin|deicines|hospital|hospit|doctor|checkup|\bscans?\b|\btests?\b|vitamin|tablet|hemoglobin|protinex|blood/i,
  },
  {
    bucket: "living",
    category: "Rent, utilities and tech subs",
    pattern:
      /\brent\b|\beb\b|utilit|electric|maintain|recharge|subscription|domain|broadband|vodafone|vodaphone|\bact\b|\bgas\b|cursor|netflix|netlfix|aquaguard|aqua|neon\.tech|wifi|internet/i,
  },
  {
    bucket: "living",
    category: "Family transfers and support",
    pattern: /amma expenses|\bdad\b|\bfather\b|rakhi|sivayya|monthly expenses|payment to pavani|^pavani$|pavani cash|^pavan$|\bsister\b/i,
  },
  {
    bucket: "living",
    category: "Fuel, transit and tolls",
    pattern: /fuel|petrol|petrl|diesel|toll|fast\s?tag|transport|\bbus\b|\bauto\b|parking/i,
  },
  {
    bucket: "living",
    category: "Shopping, lifestyle and gifts",
    pattern:
      /shop|gift|dress|saree|amazon|flipkart|westside|titan|shoes|deca|miniso|movie|temple|book|case|cover|cloth|shampoo|cream|sunscreen|magnet|hook|xerox|saloon|doodle|handbag|\bbag\b|rudrabhisekham|tasmac/i,
  },
  {
    bucket: "living",
    category: "Food, dining and groceries",
    pattern:
      /food|dining|grocer|market|breakfast|break ?fast|brekfast|lunch|dinner|snack|\btea\b|coffee|meal|tiffin|fruit|coconut|cocunut|banana|juice|blinkit|bigbasket|swiggy|zomato|zomos|poori|puff|samosa|chips|oats|\bnuts\b|ice cream|cake|dosa|vada|bajji|panipuri|sweet|laddu|\bcorn\b|pakoda|curr(?:y|ies)|apple|honey|\beggs?\b|hotel|cafe|water bottle|kinley|\bsoda\b|\bdrink\b|a2b|udupi|poolu|soap|paper|dates/i,
  },
];

const OTHER_ID = "other-labels";
const MAX_RAW_LABELS = 8;
const RAW_LABEL_MIN = 8000;

function emptyBuckets(): Record<OutflowBucketId, number> {
  return { obligations: 0, card: 0, aside: 0, living: 0 };
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "other";
}

export function classifyExpenseLabel(label: string): { bucket: OutflowBucketId; category: string; id: string } {
  const trimmed = label.trim() || "Other";
  for (const rule of RULES) {
    if (rule.pattern.test(trimmed)) {
      return { bucket: rule.bucket, category: rule.category, id: slug(rule.category) };
    }
  }
  return { bucket: "living", category: trimmed, id: `label-${slug(trimmed)}` };
}

function shareText(amount: number, total: number) {
  if (total <= 0) return "0%";
  return `${((amount / total) * 100).toFixed(1)}%`;
}

export function buildOutflow(rows: ExpenseRow[], monthKeys: string[], today = new Date()): OutflowAnalysis {
  const currentKey = currentMonthKey(today);
  const day = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const todayIsPartial = day < daysInMonth;

  const categoryMap = new Map<string, OutflowCategory>();
  const monthBucket = new Map<string, Record<OutflowBucketId, number>>();
  const monthCategory = new Map<string, Map<string, number>>();

  for (const key of monthKeys) {
    monthBucket.set(key, emptyBuckets());
    monthCategory.set(key, new Map());
  }

  let total = 0;
  let txns = 0;
  let livingTotal = 0;
  let livingTxns = 0;

  for (const row of rows) {
    if (!monthBucket.has(row.monthKey) || !(row.amount > 0)) continue;
    const classified = classifyExpenseLabel(row.label);
    const existing = categoryMap.get(classified.id) || {
      id: classified.id,
      name: classified.category,
      bucket: classified.bucket,
      amount: 0,
      txns: 0,
    };
    existing.amount += row.amount;
    existing.txns += 1;
    categoryMap.set(classified.id, existing);

    const buckets = monthBucket.get(row.monthKey)!;
    buckets[classified.bucket] += row.amount;
    const cats = monthCategory.get(row.monthKey)!;
    cats.set(classified.id, (cats.get(classified.id) || 0) + row.amount);

    total += row.amount;
    txns += 1;
    if (classified.bucket === "living") {
      livingTotal += row.amount;
      livingTxns += 1;
    }
  }

  const ranked = [...categoryMap.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  const named = ranked.filter((row) => !row.id.startsWith("label-"));
  const raw = ranked.filter((row) => row.id.startsWith("label-"));
  const visibleRaw = raw.filter((row) => row.amount >= RAW_LABEL_MIN).slice(0, MAX_RAW_LABELS);
  const visibleRawIds = new Set(visibleRaw.map((row) => row.id));
  const kept = [...named, ...visibleRaw].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  const folded = raw.filter((row) => !visibleRawIds.has(row.id));
  const foldedIds = new Set(folded.map((row) => row.id));
  if (folded.length > 0) {
    kept.push({
      id: OTHER_ID,
      name: `Other labels (${folded.length})`,
      bucket: "living",
      amount: folded.reduce((sum, row) => sum + row.amount, 0),
      txns: folded.reduce((sum, row) => sum + row.txns, 0),
    });
  }

  const bucketTxns: Record<OutflowBucketId, number> = { obligations: 0, card: 0, aside: 0, living: 0 };
  const bucketAmounts = emptyBuckets();
  for (const row of categoryMap.values()) {
    bucketAmounts[row.bucket] += row.amount;
    bucketTxns[row.bucket] += row.txns;
  }

  const allMonths: OutflowMonth[] = monthKeys.map((key) => {
    const buckets = monthBucket.get(key) || emptyBuckets();
    const cats = monthCategory.get(key) || new Map<string, number>();
    const display = new Map<string, number>();
    for (const [id, amount] of cats) {
      const target = foldedIds.has(id) ? OTHER_ID : id;
      display.set(target, (display.get(target) || 0) + amount);
    }
    const monthTotal = OUTFLOW_BUCKETS.reduce((sum, bucket) => sum + buckets[bucket.id], 0);
    const partial = key === currentKey && todayIsPartial;
    const shortLabel = formatMonthShortLabel(key);
    return {
      key,
      shortLabel,
      axisLabel: partial ? `${shortLabel} ${day}` : shortLabel,
      partial,
      total: monthTotal,
      living: buckets.living,
      buckets,
      categories: [...display.entries()].map(([id, amount]) => ({ id, amount })),
    };
  });

  const firstIdx = allMonths.findIndex((month) => month.total > 0);
  let months: OutflowMonth[] = [];
  if (firstIdx >= 0) {
    let lastIdx = allMonths.length - 1;
    while (lastIdx > firstIdx && allMonths[lastIdx].total === 0 && allMonths[lastIdx].key !== currentKey) {
      lastIdx -= 1;
    }
    months = allMonths.slice(firstIdx, lastIdx + 1);
  }

  const buckets = OUTFLOW_BUCKETS.map((bucket) => ({
    id: bucket.id,
    name: bucket.name,
    amount: bucketAmounts[bucket.id],
    txns: bucketTxns[bucket.id],
  }));

  const notes: string[] = [];
  const open = months.find((month) => month.partial);
  const finished = months.filter((month) => !month.partial && month.total > 0);
  if (open && finished.length > 0) {
    const average = finished.reduce((sum, month) => sum + month.total, 0) / finished.length;
    if (open.total >= average * 0.85) {
      notes.push(
        `${open.axisLabel} has already reached ${formatINR(open.total)}, close to the ${formatINR(average)} average of a finished month in this view. The bar is still open.`,
      );
    } else {
      notes.push(`${open.axisLabel} is still open, so compare it with a finished month only after the month ends.`);
    }
  }

  const busiest = [...categoryMap.values()].sort((a, b) => b.txns - a.txns)[0];
  if (busiest && txns > 0 && busiest.txns / txns >= 0.2 && total > 0 && busiest.amount / total <= 0.1) {
    notes.push(
      `${busiest.name} is ${busiest.txns} payments and ${shareText(busiest.amount, total)} of the cash. The large payments are elsewhere.`,
    );
  }

  const top = [...buckets].filter((bucket) => bucket.amount > 0).sort((a, b) => b.amount - a.amount)[0];
  const topMeta = OUTFLOW_BUCKETS.find((bucket) => bucket.id === top?.id);
  let headline = "No expenses recorded in this financial year yet.";
  if (top && total > 0) {
    headline =
      top.id === "living"
        ? `${formatINR(total)} went to living across ${ranked.length} categories.`
        : `${formatINR(top.amount)} of ${formatINR(total)} left for ${topMeta?.sentence}. Living was ${formatINR(livingTotal)}.`;
  }

  return {
    total,
    txns,
    livingTotal,
    livingTxns,
    buckets,
    categories: kept,
    months,
    headline,
    notes,
  };
}
