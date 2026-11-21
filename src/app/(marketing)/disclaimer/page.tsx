import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Content disclaimer" };

export default function DisclaimerPage() {
  return (
    <LegalPage title="Content disclaimer" updated="21 November 2026">
      <p>
        {APP_NAME} lessons are short, original explanations written for general education. They are designed to be useful starting
        points, not complete or personalised guidance.
      </p>
      <h2>Not professional advice</h2>
      <ul>
        <li>Health, nutrition, fitness and mental-health lessons are not medical advice. Consult a qualified professional about your situation.</li>
        <li>Money and investing lessons are not financial advice and do not recommend specific products.</li>
        <li>First-aid lessons are not a substitute for certified training. In an emergency, call your local emergency number.</li>
      </ul>
      <p>
        If you are in crisis or thinking about harming yourself, please contact local emergency services or a crisis helpline right away.
      </p>
      <h2>How lessons are made</h2>
      <p>
        Lessons are written in our own words from multiple credible sources, listed under &ldquo;Sources &amp; further reading&rdquo;. AI
        tools may assist drafting, but every lesson is reviewed by a human editor before it is published. We do not reproduce book
        chapters, paid articles or audiobook recordings.
      </p>
      <h2>Spotted an issue?</h2>
      <p>If you believe a lesson is inaccurate or uses material without permission, contact us and we will review it promptly.</p>
    </LegalPage>
  );
}
