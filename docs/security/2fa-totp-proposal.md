# Proposal: optional TOTP two-factor authentication for admins

Status: **proposal only. Not implemented.**

## Goal

Admins can turn on a second sign-in step: a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy). It starts optional and can be made mandatory for admins later. Learners are unaffected.

## User flow

1. **Enable (Admin → Settings → Two-factor):** the admin re-enters their password, then sees a QR code (and the secret as text) to scan. They type the current 6-digit code to confirm. We show **10 one-time recovery codes** once, with a download/print option.
2. **Sign in:** after a correct email and password, an admin with 2FA gets a short-lived "second step" state (5 minutes, not a full session) and enters a 6-digit code or one recovery code. Only then is the 24-hour admin session created.
3. **Disable / regenerate:** requires the password plus a current code (or a recovery code). Regenerating recovery codes invalidates the old ones.
4. **Lost device:** use a recovery code. Last resort: another admin (or the server CLI) resets 2FA for the account, and that action is audit-logged.

## Design

| Part | Choice |
|---|---|
| Algorithm | RFC 6238 TOTP, SHA-1, 6 digits, 30 s step (what authenticator apps expect) |
| Clock drift | Accept ±1 step |
| Replay | Store the last accepted time-step per user; reject codes at or before it |
| Library | `otpauth` (small, maintained, no native deps) and `qrcode` to render the QR as an SVG/data URL server-side |
| Secret storage | 160-bit random secret, **encrypted at rest** with AES-256-GCM using a new `TOTP_ENCRYPTION_KEY` (32 bytes, Vercel env var). Never sent back to the browser after setup. |
| Recovery codes | 10 × 10 characters, stored only as scrypt hashes, single use |
| Rate limiting | 5 code attempts per 5 minutes per account. Failures are audit-logged. |
| Sessions | Enabling or disabling 2FA signs out all other sessions (same as a password change) |
| Password reset | A reset does not remove 2FA. The admin still needs a code or recovery code after resetting. |

### Data model (new migration for SQLite and Postgres)

```prisma
model TwoFactor {
  userId        String   @id
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  secretEnc     String   // AES-256-GCM ciphertext (iv:tag:data, base64)
  enabledAt     DateTime?
  lastUsedStep  Int      @default(0)
  createdAt     DateTime @default(now())
}

model RecoveryCode {
  id        String    @id @default(uuid())
  userId    String
  codeHash  String
  usedAt    DateTime?
  @@index([userId])
}

model LoginChallenge {           // the short-lived "password OK, code pending" state
  id         String   @id @default(uuid())
  tokenHash  String   @unique
  userId     String
  expiresAt  DateTime            // 5 minutes
  attempts   Int      @default(0)
}
```

### API

- `POST /api/me/2fa/setup` (password required) returns the otpauth URI and QR. The secret is saved as pending.
- `POST /api/me/2fa/enable` `{ code }` turns 2FA on and returns the recovery codes once.
- `POST /api/me/2fa/disable` `{ password, code | recoveryCode }`.
- `POST /api/auth/login`: for 2FA accounts it returns `{ twoFactorRequired: true }` and sets a challenge cookie instead of a session.
- `POST /api/auth/login/2fa` `{ code | recoveryCode }` completes sign-in.

### Testing plan

Unit tests for TOTP verification with a fixed clock (drift window, replay rejection), encryption round-trip and tamper detection, and single-use recovery codes. Integration tests for the login challenge (expiry, attempt limit, no session before the code). A browser test for enable, sign out, sign in with code, and sign in with a recovery code.

## Effort and rollout

About 1–1.5 days including tests. Roll out as optional for admins first. Once every admin has enrolled, consider making it mandatory for the admin role (with a grace period that asks them to enroll on their next sign-in).

## Decisions needed before building

1. Optional, or mandatory for admins (and when)?
2. Should another admin be able to reset someone's 2FA, or only the server CLI?
3. OK to add `otpauth` + `qrcode` dependencies and a new `TOTP_ENCRYPTION_KEY` secret?
