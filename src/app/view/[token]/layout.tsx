import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Private view",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ViewTokenLayout({ children }: { children: React.ReactNode }) {
  noStore();
  return children;
}
