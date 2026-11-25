/**
 * Checks the email configuration WITHOUT sending anything.
 *   npm run email:check                       (reads the current shell environment; does not load .env)
 * Live sending requires EMAIL_PROVIDER=resend, RESEND_API_KEY, EMAIL_FROM (verified domain)
 * and EMAIL_SENDING_ENABLED=true.
 */
import { emailConfigStatus } from "../src/server/email";

const s = emailConfigStatus();
console.log(`provider:      ${s.provider}`);
console.log(`live sending:  ${s.liveSending ? "ON (emails will be delivered)" : "off (emails are only logged)"}`);
for (const p of s.problems) console.log(`  • ${p}`);
if (s.provider !== "resend") console.log("To prepare Resend: set EMAIL_PROVIDER=resend, RESEND_API_KEY and EMAIL_FROM, then EMAIL_SENDING_ENABLED=true when approved.");
