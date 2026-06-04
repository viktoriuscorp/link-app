import { NextRequest, NextResponse } from "next/server";
import { createShortLink, getSnapshot } from "@/lib/store";
import { createLinkSchema } from "@/lib/validators";

export async function GET() {
  const snapshot = await getSnapshot();
  return NextResponse.json(snapshot.links);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = createLinkSchema.parse(body);
    const link = await createShortLink({
      title: payload.title,
      slug: payload.slug || undefined,
      targetUrl: payload.targetUrl,
      domainId: payload.domainId === "base" ? null : payload.domainId
    });

    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo crear el link." },
      { status: 400 }
    );
  }
}
