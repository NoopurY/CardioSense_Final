import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/analysis",
  "/history",
  "/statistics",
  "/device",
  "/alerts",
  "/reports",
  "/profile",
  "/settings",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  if (!isProtected) return NextResponse.next();

  const accessToken = request.cookies.get("access_token")?.value;
  if (!accessToken) {
    const login = new URL("/auth/login", request.url);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/analysis/:path*",
    "/history/:path*",
    "/statistics/:path*",
    "/device/:path*",
    "/alerts/:path*",
    "/reports/:path*",
    "/profile/:path*",
    "/settings/:path*",
  ],
};
