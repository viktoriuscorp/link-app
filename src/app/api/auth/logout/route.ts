import { NextResponse } from "next/server";
import { logoutCurrentSession, SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  await logoutCurrentSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
