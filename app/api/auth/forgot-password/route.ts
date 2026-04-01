import { ok } from "@/lib/server/http";

export async function POST() {
  return ok({ message: "If account exists, OTP has been sent" });
}
