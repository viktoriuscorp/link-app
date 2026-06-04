import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieOptions, loginUser, SESSION_COOKIE } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = loginSchema.parse(body);
    const { user, sessionId } = await loginUser(payload);
    const response = NextResponse.json(user);
    response.cookies.set(SESSION_COOKIE, sessionId, getSessionCookieOptions());
    return response;
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo iniciar sesion." },
      { status: 400 }
    );
  }
}
