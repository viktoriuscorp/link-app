import { NextRequest, NextResponse } from "next/server";
import { createApiKey, listApiKeys } from "@/lib/api-keys";
import { requireCurrentUser } from "@/lib/auth";
import { createApiKeySchema } from "@/lib/validators";

export async function GET() {
  try {
    await requireCurrentUser();
  } catch {
    return NextResponse.json({ message: "No autenticado." }, { status: 401 });
  }

  const apiKeys = await listApiKeys();
  return NextResponse.json(apiKeys);
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const body = await request.json();
    const payload = createApiKeySchema.parse(body);
    const result = await createApiKey({ name: payload.name, userId: user.id });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo crear la API Key." },
      { status: 400 }
    );
  }
}
