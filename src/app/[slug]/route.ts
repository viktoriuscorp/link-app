import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { resolveShortLink } from "@/lib/store";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const headerList = await headers();
  const host = headerList.get("host") || "localhost";
  const link = await resolveShortLink(host, slug, {
    country: headerList.get("cf-ipcountry") || headerList.get("x-vercel-ip-country") || "Local",
    ip: headerList.get("cf-connecting-ip") || headerList.get("x-forwarded-for") || "local",
    referrer: headerList.get("referer") || "",
    userAgent: headerList.get("user-agent") || ""
  });

  if (!link) {
    notFound();
  }

  redirect(link.targetUrl);
}
