import { customAlphabet, nanoid } from "nanoid";
import { CNAME_TARGET } from "./config";
import type { Domain, ShortLink, Store } from "./types";

const STORE_KEY = "link-app:store";
const slugId = customAlphabet("23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", 7);
type StoreKv = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
};

const emptyStore = (): Store => ({
  domains: [],
  links: []
});

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
    return raw ? (JSON.parse(raw) as Store) : emptyStore();
  }

  await ensureFileStore();
  const { fs, storePath } = await getStorePath();
  const raw = await fs.readFile(storePath, "utf8");
  return JSON.parse(raw) as Store;
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
    links: store.links.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
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

export async function createShortLink(input: {
  title: string;
  slug?: string;
  targetUrl: string;
  domainId: string | null;
}): Promise<ShortLink> {
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
  input: Partial<Pick<ShortLink, "title" | "targetUrl">>
) {
  const store = await readStore();
  const link = store.links.find((item) => item.id === linkId);

  if (!link) {
    throw new Error("Link no encontrado.");
  }

  link.title = input.title ?? link.title;
  link.targetUrl = input.targetUrl ?? link.targetUrl;
  link.updatedAt = new Date().toISOString();
  await writeStore(store);
  return link;
}

export async function deleteShortLink(linkId: string) {
  const store = await readStore();
  const before = store.links.length;
  store.links = store.links.filter((link) => link.id !== linkId);

  if (store.links.length === before) {
    throw new Error("Link no encontrado.");
  }

  await writeStore(store);
}

export async function resolveShortLink(hostname: string, slug: string) {
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

  link.clicks += 1;
  link.lastClickedAt = new Date().toISOString();
  await writeStore(store);
  return link;
}

async function generateAvailableSlug(store: Store, domainId: string | null) {
  let slug = slugId();

  while (store.links.some((link) => link.slug === slug && link.domainId === domainId)) {
    slug = slugId();
  }

  return slug;
}
