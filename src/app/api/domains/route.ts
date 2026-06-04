import { NextRequest, NextResponse } from "next/server";
import { createDomain, getSnapshot } from "@/lib/store";
import { createDomainSchema } from "@/lib/validators";

export async function GET() {
  const snapshot = await getSnapshot();
  return NextResponse.json(snapshot.domains);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = createDomainSchema.parse(body);
    const domain = await createDomain(payload.hostname);

    return NextResponse.json(domain, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo anadir el dominio." },
      { status: 400 }
    );
  }
}
