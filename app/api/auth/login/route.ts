import { cookies, headers } from "next/headers";
import { signToken, verifyPassword } from "@/lib/server/auth";
import { fail, ok } from "@/lib/server/http";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { sanitizeText } from "@/lib/server/sanitize";
import { connectMongo } from "@/lib/server/mongodb";
import { UserModel } from "@/lib/server/models";

export async function POST(request: Request) {
  await connectMongo();
  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`login:${ip}`)) return fail("Too many attempts", 429);

  const body = await request.json();
  const email = sanitizeText(body.email).toLowerCase();
  const password = sanitizeText(body.password);
  const user = await UserModel.findOne({ email });
  if (!user) return fail("Invalid credentials", 401);
  if (!user.passwordHash) return fail("Use Google Sign In for this account", 400);

  const valid = await verifyPassword(password, user.passwordHash as string);
  if (!valid) return fail("Invalid credentials", 401);

  const token = await signToken({ sub: String(user._id), email: user.email });
  (await cookies()).set("access_token", token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return ok({ user: { id: String(user._id), email: user.email, name: user.name } });
}
