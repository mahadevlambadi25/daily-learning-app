import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { hashPassword, hashToken, verifyPassword } from "@/lib/auth/tokens";
import {
  ADMIN_SESSION_TTL_MS,
  LEARNER_SESSION_TTL_MS,
  isSessionActive,
  passwordProblems,
  sessionExpiresAt,
  sessionTtlMs,
} from "@/lib/auth/policy";
import { authenticate, changePassword, requestPasswordReset, resetPassword } from "@/server/users";
import { consoleProvider, createMemoryProvider, emailConfigStatus, getEmailProvider, resendProvider } from "@/server/email";
import { resetDb } from "./helpers";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("session lifetime policy", () => {
  const now = new Date("2026-11-23T12:00:00Z");

  it("gives admins 24 hours and keeps learners at 30 days", () => {
    expect(sessionTtlMs(true)).toBe(ADMIN_SESSION_TTL_MS);
    expect(ADMIN_SESSION_TTL_MS).toBe(DAY);
    expect(sessionTtlMs(false)).toBe(LEARNER_SESSION_TTL_MS);
    expect(LEARNER_SESSION_TTL_MS).toBe(30 * DAY);
  });

  it("caps an existing 30-day session at 24 hours once the user is an admin", () => {
    const old = { createdAt: new Date(now.getTime() - 25 * HOUR), expiresAt: new Date(now.getTime() + 29 * DAY) };
    expect(isSessionActive(old, false, now)).toBe(true); // learner: still valid
    expect(isSessionActive(old, true, now)).toBe(false); // admin: over 24h, rejected
    expect(sessionExpiresAt(old, true).getTime()).toBe(old.createdAt.getTime() + DAY);
  });

  it("accepts a fresh admin session and respects the stored expiry", () => {
    const fresh = { createdAt: new Date(now.getTime() - 2 * HOUR), expiresAt: new Date(now.getTime() + 22 * HOUR) };
    expect(isSessionActive(fresh, true, now)).toBe(true);
    const expired = { createdAt: new Date(now.getTime() - HOUR), expiresAt: new Date(now.getTime() - 1) };
    expect(isSessionActive(expired, false, now)).toBe(false);
  });
});

describe("password policy", () => {
  it("requires 12+ characters for admins and 8+ for learners", () => {
    expect(passwordProblems("eleven-char", { email: "a@b.co", isAdmin: true })[0]).toMatch(/12/);
    expect(passwordProblems("eleven-char", { email: "a@b.co", isAdmin: false })).toEqual([]);
    expect(passwordProblems("river-lamp-orbit", { email: "a@b.co", isAdmin: true })).toEqual([]);
  });

  it("rejects common passwords, the email name, edge spaces and repeats", () => {
    expect(passwordProblems("Password1234", { email: "a@b.co", isAdmin: false }).join()).toMatch(/common/);
    expect(passwordProblems("mahadev-is-great", { email: "mahadev@x.com", isAdmin: true }).join()).toMatch(/email name/);
    expect(passwordProblems(" padded-password ", { email: "a@b.co", isAdmin: true }).join()).toMatch(/space/);
    expect(passwordProblems("aaaaaaaaaaaaaa", { email: "a@b.co", isAdmin: true }).join()).toMatch(/repeat/);
  });
});

describe("change password", () => {
  beforeEach(resetDb);

  async function makeAccount(opts: { admin?: boolean; password?: string } = {}) {
    const password = opts.password ?? "current-pass-123";
    return prisma.user.create({
      data: {
        email: `acct${Date.now()}${Math.random().toString(36).slice(2, 6)}@test.dev`,
        passwordHash: await hashPassword(password),
        profile: { create: { unsubscribeToken: `t-${Math.random()}` } },
        roles: { create: [{ role: "learner" }, ...(opts.admin ? [{ role: "admin" }] : [])] },
      },
    });
  }

  it("rejects a wrong current password without changing anything", async () => {
    const u = await makeAccount({ admin: true });
    await prisma.session.create({ data: { userId: u.id, tokenHash: "s1", expiresAt: new Date(Date.now() + DAY) } });
    await expect(changePassword(u.id, "not-my-password", "brand-new-admin-pass")).rejects.toMatchObject({ status: 400, code: "wrong_password" });
    expect(await prisma.session.count({ where: { userId: u.id } })).toBe(1);
    expect(await verifyPassword("current-pass-123", (await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).passwordHash)).toBe(true);
  });

  it("rejects weak or unchanged new passwords (admin needs 12+)", async () => {
    const u = await makeAccount({ admin: true });
    await expect(changePassword(u.id, "current-pass-123", "short-pass")).rejects.toMatchObject({ code: "weak_password" });
    await expect(changePassword(u.id, "current-pass-123", "current-pass-123")).rejects.toMatchObject({ code: "weak_password" });
    await expect(changePassword(u.id, "current-pass-123", "password1234")).rejects.toMatchObject({ code: "weak_password" });
  });

  it("stores a new scrypt hash, signs out every session, cancels reset links and audits", async () => {
    const u = await makeAccount({ admin: true });
    await prisma.session.createMany({
      data: [
        { userId: u.id, tokenHash: "s1", expiresAt: new Date(Date.now() + DAY) },
        { userId: u.id, tokenHash: "s2", expiresAt: new Date(Date.now() + DAY) },
      ],
    });
    await prisma.passwordResetToken.create({ data: { userId: u.id, tokenHash: "r1", expiresAt: new Date(Date.now() + HOUR) } });

    await changePassword(u.id, "current-pass-123", "quiet-river-lamp-42");

    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.passwordHash).toMatch(/^scrypt\$/);
    expect(await verifyPassword("quiet-river-lamp-42", after.passwordHash)).toBe(true);
    expect(await prisma.session.count({ where: { userId: u.id } })).toBe(0);
    expect(await prisma.passwordResetToken.count({ where: { userId: u.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { entityId: u.id, action: "password_changed" } })).toBe(1);
    await expect(authenticate(after.email, "current-pass-123")).rejects.toBeInstanceOf(ApiError);
    expect(await authenticate(after.email, "quiet-river-lamp-42")).toBe(u.id);
  });

  it("lets learners keep the 8-character minimum", async () => {
    const u = await makeAccount();
    await changePassword(u.id, "current-pass-123", "eight-ch");
    expect(await authenticate((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).email, "eight-ch")).toBe(u.id);
  });
});

describe("password reset flow", () => {
  beforeEach(resetDb);

  it("keeps only the newest reset link and applies the password policy", async () => {
    const admin = await prisma.user.create({
      data: {
        email: "boss@test.dev",
        passwordHash: await hashPassword("old-admin-password"),
        profile: { create: { unsubscribeToken: "u-boss" } },
        roles: { create: [{ role: "admin" }] },
      },
    });
    const provider = getEmailProvider() as ReturnType<typeof createMemoryProvider>;
    provider.outbox.length = 0;

    await requestPasswordReset("boss@test.dev");
    await requestPasswordReset("boss@test.dev");
    expect(await prisma.passwordResetToken.count({ where: { userId: admin.id } })).toBe(1);
    expect(provider.outbox).toHaveLength(2);
    expect(provider.outbox[1].idempotencyKey).toMatch(/^password-reset\//);

    const firstToken = decodeURIComponent(provider.outbox[0].text.match(/token=([^\s]+)/)![1]);
    const secondToken = decodeURIComponent(provider.outbox[1].text.match(/token=([^\s]+)/)![1]);
    await expect(resetPassword(firstToken, "a-strong-new-admin-pass")).rejects.toMatchObject({ code: "invalid_token" });
    await expect(resetPassword(secondToken, "too-short")).rejects.toMatchObject({ code: "weak_password" });
    await resetPassword(secondToken, "a-strong-new-admin-pass");
    expect(await authenticate("boss@test.dev", "a-strong-new-admin-pass")).toBe(admin.id);
    expect(await prisma.auditLog.count({ where: { entityId: admin.id, action: "password_reset" } })).toBe(1);
    expect((await prisma.passwordResetToken.findFirstOrThrow({ where: { tokenHash: hashToken(secondToken) } })).usedAt).not.toBeNull();
  });
});

describe("email delivery safety", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("never logs email bodies (reset tokens) in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    await consoleProvider.send({ to: "mahadev@example.com", subject: "Reset your password", html: "x", text: "https://app/reset-password?token=SECRET123" });
    const printed = log.mock.calls.flat().join(" ");
    expect(printed).not.toContain("SECRET123");
    expect(printed).not.toContain("mahadev@example.com");
    expect(printed).toContain("m***@example.com");
  });

  it("keeps Resend off until every setting and the explicit switch are present", () => {
    expect(emailConfigStatus({ EMAIL_PROVIDER: "console" }).liveSending).toBe(false);
    const partial = emailConfigStatus({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_x", EMAIL_FROM: "Daylight <hi@daylight.app>" });
    expect(partial.liveSending).toBe(false);
    expect(partial.problems.join()).toMatch(/EMAIL_SENDING_ENABLED/);
    expect(emailConfigStatus({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_x", EMAIL_FROM: "Daylight <hi@example.com>", EMAIL_SENDING_ENABLED: "true" }).liveSending).toBe(false);
    expect(
      emailConfigStatus({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_x", EMAIL_FROM: "Daylight <hi@daylight.app>", EMAIL_SENDING_ENABLED: "true" }).liveSending,
    ).toBe(true);
  });

  it("falls back to logging (never sending) when Resend isn't approved", () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "Daylight <hi@daylight.app>");
    vi.stubEnv("EMAIL_SENDING_ENABLED", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getEmailProvider().name).toBe("console");
  });

  it("calls the Resend API correctly, with an idempotency key (mocked, nothing sent)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email_123" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await resendProvider("re_test", "Daylight <hi@daylight.app>").send({
      to: "a@b.co",
      subject: "Hi",
      html: "<p>x</p>",
      text: "x",
      idempotencyKey: "password-reset/abc",
    });
    expect(res).toEqual({ ok: true, providerId: "email_123" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    expect(init.headers["Idempotency-Key"]).toBe("password-reset/abc");
    expect(JSON.parse(init.body)).toMatchObject({ from: "Daylight <hi@daylight.app>", to: ["a@b.co"], subject: "Hi" });

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: "rate limited" }), { status: 429 }));
    expect(await resendProvider("re_test", "x@y.z").send({ to: "a@b.co", subject: "s", html: "h", text: "t" })).toMatchObject({ ok: false, transient: true });
  });
});
