import { Suspense } from "react";
import TwoFactorPage from "./TwoFactorClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center formula-wash text-ink-soft">
          Loading authenticator…
        </div>
      }
    >
      <TwoFactorPage />
    </Suspense>
  );
}
