import { customAlphabet, nanoid } from "nanoid";
import { CNAME_TARGET } from "./config";
import type { ClickEvent, Domain, ShortLink, Store } from "./types";

const STORE_KEY = "link-app:store";
const slugId = customAlphabet("23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", 7);
type StoreKv = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
};

const emptyStore = (): Store => ({
  domains: [],
  links: [],
  clickEvents: []
});

type ClickMetadata = {
  country?: string;
  userAgent?: string;
  referrer?: string;
  ip?: string;
};

type LinkInput = {
  title: string;
  slug?: string;
  targetUrl: string;
  domainId: string | null;
  tags?: string | string[];
  campaign?: string;
  expiresAt?: string | null;
  clickLimit?: number | null;
  fallbackUrl?: string;
};

async function getCloudflareKv(): Promise<StoreKv | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = getCloudflareContext();
    const env = context.env as Record<string, unknown>;
    return (env.LINK_APP_STORE as StoreKv | undefined) ?? null;
  } catch {
    return null;
  }
}

async function getStorePath() {
  const [{ promises: fs }, path] = await Promise.all([import("fs"), import("path")]);
  const dataDir = path.join(process.cwd(), "data");
  const storePath = path.join(dataDir, "store.json");
  return { fs, dataDir, storePath };
}

async function ensureFileStore() {
  const { fs, dataDir, storePath } = await getStorePath();
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(storePath);
  } catch {
    await fs.writeFile(storePath, JSON.stringify(emptyStore(), null, 2), "utf8");
  }
}

export async function readStore(): Promise<Store> {
  const kv = await getCloudflareKv();

  if (kv) {
    const raw = await kv.get(STORE_KEY);
    return raw ? normalizeStore(JSON.parse(raw) as Partial<Store>) : emptyStore();
  }

  await ensureFileStore();
  const { fs, storePath } = await getStorePath();
  const raw = await fs.readFile(storePath, "utf8");
  return normalizeStore(JSON.parse(raw) as Partial<Store>);
}

export async function writeStore(store: Store) {
  const kv = await getCloudflareKv();
  const serialized = JSON.stringify(store, null, 2);

  if (kv) {
    await kv.put(STORE_KEY, serialized);
    return;
  }

  await ensureFileStore();
  const { fs, storePath } = await getStorePath();
  await fs.writeFile(storePath, serialized, "utf8");
}

export async function getSnapshot() {
  const store = await readStore();
  return {
    domains: store.domains.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt)),
    links: store.links.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt)),
    clickEvents: store.clickEvents.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 500)
  };
}

export async function createDomain(hostname: string): Promise<Domain> {
  const store = await readStore();
  const normalizedHost = hostname.toLowerCase();
  const existing = store.domains.find((domain) => domain.hostname === normalizedHost);

  if (existing) {
    throw new Error("Ese dominio ya existe.");
  }

  const domain: Domain = {
    id: nanoid(),
    hostname: normalizedHost,
    status: "pending",
    dnsTarget: CNAME_TARGET,
    createdAt: new Date().toISOString(),
    verifiedAt: null
  };

  store.domains.push(domain);
  await writeStore(store);
  return domain;
}

export async function verifyDomain(domainId: string, force = false) {
  const store = await readStore();
  const domain = store.domains.find((item) => item.id === domainId);

  if (!domain) {
    throw new Error("Dominio no encontrado.");
  }

  if (!force) {
    if (await getCloudflareKv()) {
      throw new Error("La verificacion DNS automatica no esta disponible en Cloudflare todavia. Usa Dev para marcarlo manualmente.");
    }

    const { resolveCname } = await import("dns/promises");
    const records = await resolveCname(domain.hostname);
    const isValid = records.some((record) =>
      record.replace(/\.$/, "").toLowerCase().includes(CNAME_TARGET.toLowerCase())
    );

    if (!isValid) {
      throw new Error(`El CNAME de ${domain.hostname} todavia no apunta a ${CNAME_TARGET}.`);
    }
  }

  domain.status = "verified";
  domain.verifiedAt = new Date().toISOString();
  await writeStore(store);
  return domain;
}

export async function deleteDomain(domainId: string) {
  const store = await readStore();
  const domain = store.domains.find((item) => item.id === domainId);

  if (!domain) {
    throw new Error("Dominio no encontrado.");
  }

  if (store.links.some((link) => link.domainId === domainId)) {
    throw new Error("No puedes borrar un dominio con links asociados.");
  }

  store.domains = store.domains.filter((item) => item.id !== domainId);
  await writeStore(store);
}

export async function createShortLink(input: LinkInput): Promise<ShortLink> {
  const store = await readStore();

  if (input.domainId) {
    const domain = store.domains.find((item) => item.id === input.domainId);
    if (!domain) {
      throw new Error("Dominio no encontrado.");
    }
    if (domain.status !== "verified") {
      throw new Error("Verifica el dominio antes de crear links con el.");
    }
  }

  const slug = input.slug || (await generateAvailableSlug(store, input.domainId));
  const collision = store.links.some((link) => link.slug === slug && link.domainId === input.domainId);

  if (collision) {
    throw new Error("Ese slug ya esta en uso para este dominio.");
  }

  const now = new Date().toISOString();
  const link: ShortLink = {
    id: nanoid(),
    title: input.title || new URL(input.targetUrl).hostname,
    slug,
    targetUrl: input.targetUrl,
    domainId: input.domainId,
    clicks: 0,
    uniqueClicks: 0,
    isActive: true,
    tags: normalizeTags(input.tags),
    campaign: input.campaign?.trim() || "",
    expiresAt: normalizeDateValue(input.expiresAt),
    clickLimit: input.clickLimit || null,
    fallbackUrl: input.fallbackUrl?.trim() || "",
    createdAt: now,
    updatedAt: now,
    lastClickedAt: null
  };

  store.links.push(link);
  await writeStore(store);
  return link;
}

export async function updateShortLink(
  linkId: string,
  input: Partial<
    Pick<
      ShortLink,
      "title" | "slug" | "targetUrl" | "isActive" | "campaign" | "expiresAt" | "clickLimit" | "fallbackUrl"
    >
  > & { tags?: string | string[] }
) {
  const store = await readStore();
  const link = store.links.find((item) => item.id === linkId);

  if (!link) {
    throw new Error("Link no encontrado.");
  }

  if (input.slug && input.slug !== link.slug) {
    const collision = store.links.some(
      (item) => item.id !== link.id && item.slug === input.slug && item.domainId === link.domainId
    );

    if (collision) {
      throw new Error("Ese slug ya esta en uso para este dominio.");
    }

    link.slug = input.slug;
  }

  link.title = input.title ?? link.title;
  link.targetUrl = input.targetUrl ?? link.targetUrl;
  link.isActive = input.isActive ?? link.isActive;
  link.tags = input.tags === undefined ? link.tags : normalizeTags(input.tags);
  link.campaign = input.campaign?.trim() ?? link.campaign;
  link.expiresAt = input.expiresAt === undefined ? link.expiresAt : normalizeDateValue(input.expiresAt);
  link.clickLimit = input.clickLimit === undefined ? link.clickLimit : input.clickLimit || null;
  link.fallbackUrl = input.fallbackUrl?.trim() ?? link.fallbackUrl;
  link.updatedAt = new Date().toISOString();
  await writeStore(store);
  return link;
}

export async function deleteShortLink(linkId: string) {
  const store = await readStore();
  const before = store.links.length;
  store.links = store.links.filter((link) => link.id !== linkId);
  store.clickEvents = store.clickEvents.filter((event) => event.linkId !== linkId);

  if (store.links.length === before) {
    throw new Error("Link no encontrado.");
  }

  await writeStore(store);
}

export async function resolveShortLink(hostname: string, slug: string, metadata: ClickMetadata = {}) {
  const store = await readStore();
  const hostWithoutPort = hostname.split(":")[0].toLowerCase();
  const domain = store.domains.find(
    (item) => item.hostname === hostWithoutPort && item.status === "verified"
  );
  const domainId = domain?.id ?? null;
  const link = store.links.find((item) => item.slug === slug && item.domainId === domainId);

  if (!link) {
    return null;
  }

  if (!link.isActive || isExpired(link)) {
    return link.fallbackUrl ? { ...link, targetUrl: link.fallbackUrl } : null;
  }

  const event = createClickEvent(link, metadata);
  link.clicks += 1;
  const knownVisitors = new Set(
    store.clickEvents.filter((item) => item.linkId === link.id).map((item) => item.ipHash)
  );
  if (!knownVisitors.has(event.ipHash)) {
    link.uniqueClicks += 1;
  }
  link.lastClickedAt = new Date().toISOString();
  store.clickEvents.push(event);
  await writeStore(store);
  return link;
}

function normalizeStore(store: Partial<Store>): Store {
  const normalized: Store = {
    domains: store.domains ?? [],
    links: (store.links ?? []).map((link) => ({
      ...link,
      uniqueClicks: link.uniqueClicks ?? 0,
      isActive: link.isActive ?? true,
      tags: Array.isArray(link.tags) ? link.tags : [],
      campaign: link.campaign ?? "",
      expiresAt: link.expiresAt ?? null,
      clickLimit: link.clickLimit ?? null,
      fallbackUrl: link.fallbackUrl ?? ""
    })),
    clickEvents: store.clickEvents ?? []
  };

  for (const link of normalized.links) {
    const unique = new Set(
      normalized.clickEvents.filter((event) => event.linkId === link.id).map((event) => event.ipHash)
    );
    if (unique.size > link.uniqueClicks) {
      link.uniqueClicks = unique.size;
    }
  }

  return normalized;
}

function normalizeTags(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value.join(",") : value || "";
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    )
  ).slice(0, 8);
}

function normalizeDateValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isExpired(link: ShortLink) {
  const dateExpired = link.expiresAt ? new Date(link.expiresAt).getTime() <= Date.now() : false;
  const clickExpired = link.clickLimit ? link.clicks >= link.clickLimit : false;
  return dateExpired || clickExpired;
}

function createClickEvent(link: ShortLink, metadata: ClickMetadata): ClickEvent {
  const userAgent = metadata.userAgent || "";
  const ipSeed = `${metadata.ip || "local"}:${userAgent}`;
  const parsedAgent = parseUserAgent(userAgent);

  return {
    id: nanoid(),
    linkId: link.id,
    slug: link.slug,
    domainId: link.domainId,
    createdAt: new Date().toISOString(),
    country: metadata.country || "Local",
    device: parsedAgent.device,
    browser: parsedAgent.browser,
    referrer: normalizeReferrer(metadata.referrer),
    ipHash: hashString(ipSeed)
  };
}

function parseUserAgent(userAgent: string): Pick<ClickEvent, "device" | "browser"> {
  const agent = userAgent.toLowerCase();
  const isBot = /bot|crawl|spider|slurp|facebookexternalhit|preview/.test(agent);
  const isTablet = /ipad|tablet/.test(agent);
  const isMobile = /mobile|iphone|android/.test(agent) && !isTablet;
  const browser = agent.includes("edg/")
    ? "Edge"
    : agent.includes("chrome/")
      ? "Chrome"
      : agent.includes("safari/") && !agent.includes("chrome/")
        ? "Safari"
        : agent.includes("firefox/")
          ? "Firefox"
          : "Other";

  return {
    device: isBot ? "bot" : isTablet ? "tablet" : isMobile ? "mobile" : userAgent ? "desktop" : "unknown",
    browser
  };
}

function normalizeReferrer(referrer?: string) {
  if (!referrer) {
    return "Directo";
  }

  try {
    return new URL(referrer).hostname;
  } catch {
    return referrer.slice(0, 120);
  }
}

function hashString(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}

async function generateAvailableSlug(store: Store, domainId: string | null) {
  let slug = slugId();

  while (store.links.some((link) => link.slug === slug && link.domainId === domainId)) {
    slug = slugId();
  }

  return slug;
}
