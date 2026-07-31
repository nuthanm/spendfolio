"use client";

const FORMULAS = [
  "income − expenses = buffer",
  "₹82,000 + ₹14,500",
  "balance ÷ days left",
  "safe if spend < 70%",
  "renewal → Aug 02",
  "Σ breakfast…dinner",
  "debt = expenses > income",
  "₹54,440 remaining",
  "month.math()",
  "import → preview → commit",
];

export function FormulaField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {FORMULAS.map((text, i) => (
        <span
          key={text}
          className="formula-float absolute font-mono text-[11px] tracking-wide text-ink/25 md:text-xs"
          style={{
            left: `${8 + ((i * 17) % 80)}%`,
            bottom: `-${10 + (i % 5) * 8}%`,
            animationDuration: `${18 + (i % 6) * 3}s`,
            animationDelay: `${i * 1.4}s`,
          }}
        >
          {text}
        </span>
      ))}
    </div>
  );
}
