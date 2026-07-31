import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "spendfolio_session";
const PENDING_COOKIE = "spendfolio_pending";

const PROTECTED = ["/dashboard", "/income", "/expenses", "/import", "/account"];

function secretKey() {
  const secret = process.env.AUTH_SECRET || "spendfolio-dev-secret-change-me-in-production-32chars";
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!needsAuth) {
    if (pathname === "/login/2fa") {
      const pending = request.cookies.get(PENDING_COOKIE)?.value;
      if (!pending) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      try {
        const { payload } = await jwtVerify(pending, secretKey());
        if (payload.kind !== "pending_2fa") {
          return NextResponse.redirect(new URL("/login", request.url));
        }
      } catch {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.kind !== "full") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/income/:path*",
    "/expenses/:path*",
    "/import/:path*",
    "/account/:path*",
    "/login/2fa",
  ],
};
