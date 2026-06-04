import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const HSTS_HEADER = "max-age=31536000; includeSubDomains; preload";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const cfVisitor = request.headers.get("cf-visitor") ?? "";
  const isHttp =
    request.nextUrl.protocol === "http:" || forwardedProto === "http" || cfVisitor.includes('"scheme":"http"');

  if (!isLocal && isHttp) {
    const secureUrl = request.nextUrl.clone();
    secureUrl.protocol = "https:";
    const response = NextResponse.redirect(secureUrl, 308);
    response.headers.set("Strict-Transport-Security", HSTS_HEADER);
    return response;
  }

  const response = NextResponse.next();

  if (!isLocal) {
    response.headers.set("Strict-Transport-Security", HSTS_HEADER);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
