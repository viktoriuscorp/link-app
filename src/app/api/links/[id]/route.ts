import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { deleteShortLink, updateShortLink } from "@/lib/store";
import { updateLinkSchema } from "@/lib/validators";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCurrentUser();
    const { id } = await context.params;
    const body = await request.json();
    const payload = updateLinkSchema.parse(body);
    const link = await updateShortLink(id, payload);

    return NextResponse.json(link);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo actualizar el link." },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCurrentUser();
    const { id } = await context.params;
    await deleteShortLink(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo borrar el link." },
      { status: 400 }
    );
  }
}
