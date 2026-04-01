import { cookies } from "next/headers";
import { signToken } from "@/lib/server/auth";
import { fail, requireUser, ok } from "@/lib/server/http";

export async function POST() {
  const user = await requireUser();
  if (!user) return fail("Unauthorized", 401);

  const token = await signToken({ sub: user.sub, email: user.email });
  (await cookies()).set("access_token", token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return ok({ refreshed: true });
}
