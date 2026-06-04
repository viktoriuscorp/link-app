import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieOptions, registerUser, SESSION_COOKIE } from "@/lib/auth";
import { registerSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = registerSchema.parse(body);
    const { user, sessionId } = await registerUser(payload);
    const response = NextResponse.json(user, { status: 201 });
    response.cookies.set(SESSION_COOKIE, sessionId, getSessionCookieOptions());
    return response;
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo registrar." },
      { status: 400 }
    );
  }
}
