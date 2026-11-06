import { describe, it, expect } from "vitest";

import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "@/lib/validation/auth";

describe("auth validation schemas", () => {
  it("accepts a valid login", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.co", password: "123456" }).success,
    ).toBe(true);
  });

  it("rejects bad emails and short passwords", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "123456" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "123" }).success).toBe(false);
  });

  it("signup requires a name, a phone and an 8+ char password", () => {
    expect(
      signupSchema.safeParse({ fullName: "ע", phone: "0501234567", email: "a@b.co", password: "12345678" }).success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({ fullName: "עפר", phone: "0501234567", email: "a@b.co", password: "1234567" }).success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({ fullName: "עפר", email: "a@b.co", password: "12345678" }).success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({ fullName: "עפר", phone: "050123", email: "a@b.co", password: "12345678" }).success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({ fullName: "עפר", phone: "0501234567", email: "a@b.co", password: "12345678" }).success,
    ).toBe(true);
  });

  it("forgot-password validates the email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.co" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });

  it("reset-password requires matching passwords", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "12345678", confirm: "12345678" }).success,
    ).toBe(true);
    const mismatch = resetPasswordSchema.safeParse({ password: "12345678", confirm: "87654321" });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.issues[0]?.message).toBe("הסיסמאות אינן זהות");
    }
  });

  it("change-password requires the current password and matching new ones", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "",
        password: "12345678",
        confirm: "12345678",
      }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "old-pass",
        password: "12345678",
        confirm: "12345678",
      }).success,
    ).toBe(true);
  });
});
