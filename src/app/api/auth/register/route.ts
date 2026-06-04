import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ message: "El registro publico esta desactivado." }, { status: 403 });
}
