import type { Metadata } from "next";
import { redirectIfSignedIn } from "@/lib/auth/session";
import { SignupForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage() {
  await redirectIfSignedIn();
  return <SignupForm />;
}
