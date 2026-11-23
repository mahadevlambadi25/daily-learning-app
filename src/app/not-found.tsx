import { Compass } from "lucide-react";
import { Logo } from "@/components/brand";
import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo />
      <div className="mt-12 grid size-16 place-items-center rounded-3xl bg-accent-soft text-accent">
        <Compass className="size-8" aria-hidden />
      </div>
      <h1 className="mt-6 font-display text-4xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-sm text-muted">Check the address, or use one of these:</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <LinkButton href="/today">Today&apos;s lessons</LinkButton>
        <LinkButton href="/login" variant="secondary">
          Sign in
        </LinkButton>
      </div>
    </div>
  );
}
