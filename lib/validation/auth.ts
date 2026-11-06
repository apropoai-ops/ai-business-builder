import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("כתובת אימייל לא תקינה"),
  password: z.string().min(6, "הסיסמה חייבת להכיל לפחות 6 תווים"),
});

export const signupSchema = z.object({
  fullName: z.string().min(2, "יש להזין שם מלא"),
  phone: z.string().trim().min(9, "יש להזין טלפון תקין").max(40),
  email: z.string().email("כתובת אימייל לא תקינה"),
  password: z.string().min(8, "הסיסמה חייבת להכיל לפחות 8 תווים"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("כתובת אימייל לא תקינה"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "הסיסמה חייבת להכיל לפחות 8 תווים"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "הסיסמאות אינן זהות",
    path: ["confirm"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "יש להזין את הסיסמה הנוכחית"),
    password: z.string().min(8, "הסיסמה החדשה חייבת להכיל לפחות 8 תווים"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "הסיסמאות אינן זהות",
    path: ["confirm"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
