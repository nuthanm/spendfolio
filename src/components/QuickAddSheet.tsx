"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addExpense } from "@/lib/actions/expenses";
import { DEFAULT_EXPENSE_LABELS, formatINR } from "@/lib/finance";
import { CloseIcon } from "@/components/icons";

/** Fired after any quick add so client-loaded screens can refetch. */
export const DATA_CHANGED_EVENT = "spendfolio:data-changed";

const COMMON_LABELS = ["Groceries", "Lunch", "Dinner", "Breakfast", "Tea or Coffee", "Transport", "Petrol", "Utilities", "Subscription", "Health", "Other"];

function todayKey() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function QuickAddSheet({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const titleId = useId();
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState<string>("Groceries");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayKey);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setAmount("");
      setNote("");
      setError(null);
      setDate(todayKey());
      dialog.showModal();
      // Ready to type the amount straight away.
      amountRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const amountValue = Number(amount.replace(/[^0-9.]/g, ""));
  const canSave = amountValue > 0 && Boolean(label) && Boolean(date);
  const labels = showAll ? [...DEFAULT_EXPENSE_LABELS] : COMMON_LABELS;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    const fd = new FormData();
    fd.set("date", date);
    fd.set("label", label);
    fd.set("amount", String(amountValue));
    fd.set("remarks", note.trim());
    fd.set("recurring", "false");
    fd.set("customFields", "{}");
    setError(null);
    startTransition(async () => {
      const res = await addExpense(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
      router.refresh();
      onSaved(`Added ${formatINR(amountValue)} to ${label}`);
      onClose();
    });
  }

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // Tapping the dimmed backdrop closes the sheet.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form onSubmit={submit} className="flex flex-col gap-5 p-5 pb-7">
        <div className="mx-auto h-1 w-10 rounded-full bg-line md:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-semibold">
            Add expense
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-paper-deep"
          >
            <CloseIcon />
          </button>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-ink-soft">Amount</span>
          <span className="flex items-baseline gap-2 border-b-2 border-ink pb-1.5">
            <span className="font-display text-3xl font-bold">₹</span>
            <input
              ref={amountRef}
              required
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full min-w-0 bg-transparent font-display text-4xl font-extrabold tracking-tight text-ink outline-none placeholder:text-ink-soft/50"
            />
          </span>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm text-ink-soft">Spent on</legend>
          <div className="flex flex-wrap gap-2">
            {labels.map((item) => {
              const selected = item === label;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setLabel(item)}
                  className={`min-h-10 rounded-full border px-3.5 text-sm font-medium ${
                    selected ? "border-ink bg-ink text-on-ink" : "border-line text-ink hover:border-mint"
                  }`}
                >
                  {item}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="min-h-10 rounded-full px-3 text-sm font-medium text-mint underline-offset-4 hover:underline"
            >
              {showAll ? "Fewer" : "More…"}
            </button>
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Note (optional)</span>
            <input
              className="field rounded-xl"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was it for?"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Date</span>
            <input
              type="date"
              required
              className="field rounded-xl"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-coral">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canSave || pending}
          className="btn-primary min-h-13 rounded-2xl py-3.5 text-base font-semibold disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save expense"}
        </button>
        <p className="-mt-2 text-center text-xs text-ink-soft">
          Recurring bills and custom fields live on the Expenses page.
        </p>
      </form>
    </dialog>
  );
}
