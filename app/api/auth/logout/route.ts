import { cookies } from "next/headers";
import { ok } from "@/lib/server/http";

export async function POST() {
  (await cookies()).set("access_token", "", { httpOnly: true, expires: new Date(0), path: "/" });
  return ok({ success: true });
}
