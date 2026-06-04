import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { verifyDomain } from "@/lib/store";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCurrentUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const domain = await verifyDomain(id, Boolean(body.force));

    return NextResponse.json(domain);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo verificar el dominio." },
      { status: 400 }
    );
  }
}
