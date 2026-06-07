// /verify-email/resend — log in first, then redirect to the pending page.
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function ResendRedirect() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect("/verify-email/pending");
}
