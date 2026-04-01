import { cookies } from "next/headers";
import { verifyToken } from "@/lib/server/auth";

export function ok(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function requireUser() {
  const token = (await cookies()).get("access_token")?.value;
  if (token) {
    try {
      return await verifyToken(token);
    } catch {
      return null;
    }
  }

  return null;
}
