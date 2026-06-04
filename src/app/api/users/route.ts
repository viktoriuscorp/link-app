import { NextResponse } from "next/server";
import { listUsers, requireCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    await requireCurrentUser();
    const users = await listUsers();
    return NextResponse.json(users);
  } catch {
    return NextResponse.json({ message: "No autenticado." }, { status: 401 });
  }
}
