import type { Metadata } from "next";
import { APP_NAME, supportEmail } from "@/lib/config";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated="21 November 2026">
      <p>
        These terms govern your use of {APP_NAME}. By creating an account you agree to them. If you do not agree, please do not use the
        service.
      </p>
      <h2>Your account</h2>
      <ul>
        <li>You must provide a valid email address and keep your password secure.</li>
        <li>You are responsible for activity under your account. Tell us promptly about any unauthorised use.</li>
        <li>You can delete your account at any time from Settings.</li>
      </ul>
      <h2>Content</h2>
      <p>
        Lessons are original educational summaries for general information. They are not professional, medical, financial, legal or
        psychological advice. See our content disclaimer for details.
      </p>
      <p>All lesson content is owned by or licensed to {APP_NAME}. You may read and share links to it, but not copy or republish it.</p>
      <h2>Acceptable use</h2>
      <ul>
        <li>Do not attempt to access other users&apos; data or administrative areas.</li>
        <li>Do not disrupt, scrape or overload the service.</li>
      </ul>
      <h2>Changes and availability</h2>
      <p>We may update the service and these terms. We will notify you of material changes. The service is provided &ldquo;as is&rdquo; during the MVP.</p>
      <h2>Contact</h2>
      <p>
        Questions? Email <a className="font-semibold underline" href={`mailto:${supportEmail()}`}>{supportEmail()}</a>.
      </p>
    </LegalPage>
  );
}
