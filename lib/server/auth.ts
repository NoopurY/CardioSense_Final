import { jwtVerify, SignJWT } from "jose";
import bcrypt from "bcryptjs";

const secret = new TextEncoder().encode(process.env.SECRET_KEY ?? "dev-secret-key-change-me");
const algorithm = "HS256";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signToken(payload: { sub: string; email: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: algorithm })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(secret);
}

export async function verifyToken(token: string) {
  const result = await jwtVerify(token, secret, { algorithms: [algorithm] });
  return result.payload as { sub: string; email: string };
}
