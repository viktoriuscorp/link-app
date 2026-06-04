import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { deleteDomain } from "@/lib/store";

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCurrentUser();
    const { id } = await context.params;
    await deleteDomain(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo borrar el dominio." },
      { status: 400 }
    );
  }
}
