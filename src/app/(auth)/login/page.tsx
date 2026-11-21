import type { Metadata } from "next";
import { redirectIfSignedIn } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await redirectIfSignedIn();
  const { next } = await searchParams;
  return <LoginForm next={next} />;
}
