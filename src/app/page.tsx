import Link from "next/link";
import { FormulaField } from "@/components/FormulaField";
import { HeroLedgerVisual, LandingFaq } from "@/components/LandingExtras";

const FEATURES = [
  {
    eyebrow: "Monthly overview",
    title: "Your money, clearly calculated",
    body: "See income, expenses, and buffer at a glance. Spendfolio tells you if you’re safe, tight, or in debt — always for the current month, with history one switch away.",
    points: ["Live income − expenses = buffer", "Safe / tight / debt status", "Previous months on demand"],
  },
  {
    eyebrow: "Renewals & remarks",
    title: "Never miss a payment reminder",
    body: "Log when you bought a domain, when it renews, or any note you’d keep in a spreadsheet column. Near-due renewals highlight on the dashboard.",
    points: ["Remarks on every expense", "Renewal date tracking", "Dashboard highlights"],
  },
  {
    eyebrow: "Custom expense forms",
    title: "Build the form around your life",
    body: "Start with Breakfast, Lunch, Dinner, Recharge… then dynamically add textboxes, dropdowns, checkboxes, or textareas and bind them to your entries.",
    points: ["Preset spending labels", "Add any field type", "Bind & save instantly"],
  },
  {
    eyebrow: "Import with preview",
    title: "Bring Excel in — only when it looks right",
    body: "Upload your existing file, review mapped columns and row preview, then commit. Nothing inserts until you approve the preview.",
    points: ["CSV / Excel support", "Column mapping preview", "Confirm before insert"],
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen formula-wash">
      <FormulaField />

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-line/50 bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <a href="#home" className="text-lg font-bold tracking-tight text-ink">
            Spendfolio
          </a>
          <nav className="hidden items-center gap-7 text-sm text-ink-soft md:flex">
            <a href="#features" className="hover:text-ink">
              Features
            </a>
            <a href="#privacy" className="hover:text-ink">
              Privacy
            </a>
            <a href="#faq" className="hover:text-ink">
              FAQ
            </a>
            <a href="#start" className="hover:text-ink">
              Start
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn-secondary px-3 py-2 text-sm">
              Sign in
            </Link>
            <Link href="/dashboard" className="btn-primary px-3 py-2 text-sm">
              Open prototype
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — Numora-style split: copy left, product visual right */}
      <section id="home" className="relative overflow-hidden">
        <div className="ledger-grid absolute inset-0 opacity-30" />
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 lg:grid-cols-2 lg:gap-16 lg:pb-28 lg:pt-20">
          <div>
            <p className="anim-rise mb-4 font-mono text-xs uppercase tracking-[0.22em] text-mint">
              private ledger · monthly math
            </p>
            <h1 className="anim-rise-delay-1 text-5xl font-extrabold leading-[0.95] tracking-tight text-ink md:text-6xl lg:text-7xl">
              Spendfolio
            </h1>
            <p className="anim-rise-delay-2 mt-5 max-w-md text-xl font-semibold leading-snug text-ink">
              Smarter monthly tracking. Clearer decisions.
            </p>
            <p className="anim-rise-delay-2 mt-4 max-w-lg text-base leading-relaxed text-ink-soft md:text-lg">
              Day-wise spending, renewal reminders, and free-form remarks — without parking
              your money trail in shared cloud sheets.
            </p>
            <div className="anim-rise-delay-3 mt-8 flex flex-wrap items-center gap-3">
              <Link href="/dashboard" className="btn-primary px-6 py-3 text-sm font-medium">
                Explore the prototype
              </Link>
              <Link href="/login" className="btn-secondary px-6 py-3 text-sm">
                Login + 2FA
              </Link>
            </div>
          </div>

          <div className="anim-rise-delay-2">
            <HeroLedgerVisual />
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-line/60 bg-white/35">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 sm:grid-cols-3">
          {[
            { k: "2FA", v: "Authenticator on every login" },
            { k: "Export", v: "CSV / Excel anytime you leave" },
            { k: "Local feel", v: "Your remarks stay with you" },
          ].map((item) => (
            <div key={item.k} className="text-center sm:text-left">
              <p className="font-mono text-[11px] uppercase tracking-widest text-mint">{item.k}</p>
              <p className="mt-1 text-sm text-ink-soft">{item.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature sections — alternating like Numora */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-5 py-20 md:py-28">
        <div className="mb-14 max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-mint">What you get</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink md:text-5xl">
            Built for how you already track — just safer
          </h2>
        </div>

        <div className="space-y-20 md:space-y-28">
          {FEATURES.map((feature, index) => {
            const reverse = index % 2 === 1;
            return (
              <article
                key={feature.eyebrow}
                className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
                  reverse ? "" : ""
                }`}
              >
                <div className={reverse ? "lg:order-2" : ""}>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mint">
                    {feature.eyebrow}
                  </p>
                  <h3 className="mt-3 text-2xl font-bold tracking-tight text-ink md:text-3xl">
                    {feature.title}
                  </h3>
                  <p className="mt-4 text-base leading-relaxed text-ink-soft">{feature.body}</p>
                  <ul className="mt-6 space-y-2">
                    {feature.points.map((point) => (
                      <li key={point} className="flex items-start gap-3 text-sm text-ink">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-mint" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>

                <FeatureVisual index={index} className={reverse ? "lg:order-1" : ""} />
              </article>
            );
          })}
        </div>
      </section>

      {/* Privacy / security band */}
      <section id="privacy" className="border-y border-line/60 bg-ink text-[#f4faf7]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2 md:py-20">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-mint-bright">
              For safety of your data
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Login. Authenticator. Logout that actually sticks.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/70">
              After logout, the session is invalidated — no silent re-entry. Changing password
              always asks for 2FA. Enable or disable authenticator from Account.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { t: "Login + 2FA", d: "Password then authenticator code" },
              { t: "Hard logout", d: "Token gone — full login required again" },
              { t: "Export / delete", d: "Take your data or wipe the account" },
              { t: "Password change", d: "Always gated by fresh 2FA" },
            ].map((item) => (
              <div key={item.t} className="border border-white/15 bg-white/5 p-4">
                <p className="font-semibold">{item.t}</p>
                <p className="mt-1 text-sm text-white/65">{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative z-10 mx-auto max-w-6xl px-5 py-20 md:py-28">
        <div className="mb-10 max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-mint">FAQs</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink md:text-4xl">
            We’ve got the answers you’re looking for
          </h2>
        </div>
        <LandingFaq />
      </section>

      {/* Final CTA — Numora-style closing */}
      <section id="start" className="relative z-10 border-t border-line/60">
        <div className="mx-auto max-w-6xl px-5 py-20 text-center md:py-28">
          <h2 className="text-3xl font-bold tracking-tight text-ink md:text-5xl">
            Experience private monthly tracking today
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-ink-soft">
            Open the visual prototype — dashboard, income, customizable expenses, import
            preview, and account controls — then tell us what to refine.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/dashboard" className="btn-primary px-7 py-3.5 text-sm font-medium">
              Open dashboard
            </Link>
            <Link href="/expenses" className="btn-secondary px-7 py-3.5 text-sm">
              Try expense form
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line/60 bg-white/30">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <p className="font-bold text-ink">Spendfolio</p>
          <p className="font-mono text-xs">Prototype · your ledger, your math</p>
          <div className="flex gap-4">
            <Link href="/account" className="hover:text-ink">
              Account
            </Link>
            <Link href="/import" className="hover:text-ink">
              Import
            </Link>
            <Link href="/login" className="hover:text-ink">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureVisual({ index, className = "" }: { index: number; className?: string }) {
  const panels = [
    <div key="0" className="border border-line bg-white/55 p-6">
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">equation</p>
      <p className="mt-3 font-mono text-lg text-ink">₹98,600 − ₹44,160</p>
      <p className="mt-1 text-3xl font-bold text-mint">= ₹54,440</p>
      <p className="mt-4 inline-block status-safe px-3 py-1 text-xs font-semibold">Safe buffer</p>
      <p className="mt-3 text-sm text-ink-soft">Spending 44.8% of income this month.</p>
    </div>,
    <div key="1" className="space-y-2 border border-line bg-white/55 p-5">
      {[
        { t: "Cursor Pro", d: "2d left", hot: true },
        { t: "Electricity", d: "3d left", hot: true },
        { t: "nuthan.dev", d: "Jul 2027", hot: false },
      ].map((r) => (
        <div
          key={r.t}
          className={`border border-line/70 px-3 py-3 ${r.hot ? "highlight-renewal" : ""}`}
        >
          <p className="text-sm font-medium text-ink">{r.t}</p>
          <p className="font-mono text-[10px] text-ink-soft">{r.d}</p>
        </div>
      ))}
    </div>,
    <div key="2" className="border border-line bg-white/55 p-5">
      <p className="text-sm font-semibold text-ink">Expense fields</p>
      <div className="mt-4 space-y-2">
        {["Label · Lunch", "Amount · ₹280", "Remarks · free text", "+ Payment mode · dropdown"].map(
          (row) => (
            <div key={row} className="border border-dashed border-line px-3 py-2 font-mono text-xs text-ink-soft">
              {row}
            </div>
          ),
        )}
      </div>
    </div>,
    <div key="3" className="border border-line bg-white/55 p-5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-mint">preview</p>
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between border-b border-line/50 py-2">
          <span>Lunch</span>
          <span className="font-mono">₹245</span>
        </div>
        <div className="flex justify-between border-b border-line/50 py-2">
          <span>Domain renewal</span>
          <span className="font-mono">₹899</span>
        </div>
        <div className="flex justify-between py-2">
          <span>Recharge</span>
          <span className="font-mono">₹399</span>
        </div>
      </div>
      <p className="mt-4 text-xs text-ink-soft">Looks good → insert into Spendfolio</p>
    </div>,
  ];

  return <div className={className}>{panels[index]}</div>;
}
