import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = { title: "שכחתי סיסמה" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;
  return <ForgotPasswordForm expiredLink={expired === "1"} />;
}
