import type { Metadata } from "next";
import { Logo } from "@/components/brand";
import { UnsubscribeConfirm } from "@/components/unsubscribe-confirm";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

/** Linked from every daily email. Requires an explicit click (link scanners must not unsubscribe users). */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-8">
      <Logo />
      <main id="main" className="flex w-full max-w-md flex-1 items-center">
        <UnsubscribeConfirm token={token ?? ""} />
      </main>
    </div>
  );
}
