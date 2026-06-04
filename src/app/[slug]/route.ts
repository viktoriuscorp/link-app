import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { resolveShortLink } from "@/lib/store";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const headerList = await headers();
  const host = headerList.get("host") || "localhost";
  const link = await resolveShortLink(host, slug);

  if (!link) {
    notFound();
  }

  redirect(link.targetUrl);
}
