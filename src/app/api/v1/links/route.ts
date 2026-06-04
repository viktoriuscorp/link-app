import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-keys";
import { createShortLink, getSnapshot } from "@/lib/store";
import { remoteCreateLinkSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    await requireApiKey(token, "links:create");
    const body = await request.json();
    const payload = remoteCreateLinkSchema.parse(body);
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
    const snapshot = await getSnapshot();
    const domain = snapshot.domains.find((item) => item.id === link.domainId);
    const shortUrl = domain ? `https://${domain.hostname}/${link.slug}` : `${request.nextUrl.origin}/${link.slug}`;

    return NextResponse.json({ link, shortUrl }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el link.";
    const status = message.includes("API Key") || message.includes("Bearer") ? 401 : 400;
    return NextResponse.json({ message }, { status });
  }
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new Error("Envia la API Key con Authorization: Bearer <token>.");
  }

  return token;
}
