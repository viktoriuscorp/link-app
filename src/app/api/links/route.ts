import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { createShortLink, getSnapshot } from "@/lib/store";
import { createLinkSchema } from "@/lib/validators";

export async function GET() {
  try {
    await requireCurrentUser();
  } catch {
    return NextResponse.json({ message: "No autenticado." }, { status: 401 });
  }

  const snapshot = await getSnapshot();
  return NextResponse.json(snapshot.links);
}

export async function POST(request: NextRequest) {
  try {
    await requireCurrentUser();
    const body = await request.json();
    const payload = createLinkSchema.parse(body);
    const link = await createShortLink({
      title: payload.title,
      slug: payload.slug || undefined,
      targetUrl: payload.targetUrl,
      domainId: payload.domainId === "base" ? null : payload.domainId,
      tags: payload.tags,
      campaign: payload.campaign,
      expiresAt: payload.expiresAt || null,
      clickLimit: payload.clickLimit || null,
      fallbackUrl: payload.fallbackUrl
    });

    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo crear el link." },
      { status: 400 }
    );
  }
}
