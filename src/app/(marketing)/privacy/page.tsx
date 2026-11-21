import type { Metadata } from "next";
import { APP_NAME, supportEmail } from "@/lib/config";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="21 November 2026">
      <p>{APP_NAME} collects only the data needed to run a personalised daily learning service.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account: email address, a securely hashed password, and an optional first name.</li>
        <li>Preferences: selected topics, timezone, delivery time, reminder and daily-email settings.</li>
        <li>Learning activity: lessons delivered, opened, completed and bookmarked, and quick-check answers.</li>
        <li>Product analytics: anonymous-by-default usage events (for example &ldquo;lesson completed&rdquo;) to improve the service.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To build your daily feed and, only if you opt in, send your daily email.</li>
        <li>To keep your progress and bookmarks in sync across devices.</li>
        <li>To understand which topics and features are useful. We do not sell your data or show ads.</li>
      </ul>
      <h2>Read-aloud</h2>
      <p>Listening uses your browser&apos;s built-in speech feature. Lesson text is spoken on your device; we do not record audio.</p>
      <h2>Email</h2>
      <p>Daily emails are off by default. Every daily email contains a one-click unsubscribe link, and you can change this anytime in Settings.</p>
      <h2>Retention and deletion</h2>
      <p>
        We keep your data while your account is active. Deleting your account from Settings permanently removes your profile,
        preferences, progress and bookmarks; analytics events are kept only in anonymised form.
      </p>
      <h2>Security</h2>
      <p>Passwords are hashed, sessions use secure HTTP-only cookies, and data is transmitted over HTTPS in production.</p>
      <h2>Contact</h2>
      <p>
        For privacy requests, email <a className="font-semibold underline" href={`mailto:${supportEmail()}`}>{supportEmail()}</a>.
      </p>
    </LegalPage>
  );
}
