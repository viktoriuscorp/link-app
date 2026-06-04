import { NextRequest, NextResponse } from "next/server";
import { revokeApiKey } from "@/lib/api-keys";
import { requireCurrentUser } from "@/lib/auth";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireCurrentUser();
  } catch {
    return NextResponse.json({ message: "No autenticado." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const apiKey = await revokeApiKey(id);
    return NextResponse.json(apiKey);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo revocar la API Key." },
      { status: 400 }
    );
  }
}
