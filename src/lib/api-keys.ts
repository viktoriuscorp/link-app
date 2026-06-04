import { customAlphabet, nanoid } from "nanoid";
import { readStore, writeStore } from "./store";
import type { ApiKey } from "./types";

const tokenId = customAlphabet("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz", 32);
const TOKEN_PREFIX = "lk_live";

export type PublicApiKey = Pick<
  ApiKey,
  "id" | "name" | "prefix" | "scopes" | "createdAt" | "lastUsedAt" | "revokedAt"
>;

export function toPublicApiKey(apiKey: ApiKey): PublicApiKey {
  return {
    id: apiKey.id,
    name: apiKey.name,
    prefix: apiKey.prefix,
    scopes: apiKey.scopes,
    createdAt: apiKey.createdAt,
    lastUsedAt: apiKey.lastUsedAt,
    revokedAt: apiKey.revokedAt
  };
}

export async function listApiKeys() {
  const store = await readStore();
  return store.apiKeys
    .map(toPublicApiKey)
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createApiKey(input: { name: string; userId: string }) {
  const store = await readStore();
  const secret = `${TOKEN_PREFIX}_${tokenId()}_${tokenId()}`;
  const prefix = secret.slice(0, 16);
  const now = new Date().toISOString();
  const apiKey: ApiKey = {
    id: nanoid(),
    name: input.name.trim(),
    prefix,
    tokenHash: await hashToken(secret),
    createdByUserId: input.userId,
    scopes: ["links:create"],
    createdAt: now,
    lastUsedAt: null,
    revokedAt: null
  };

  store.apiKeys.push(apiKey);
  await writeStore(store);
  return { apiKey: toPublicApiKey(apiKey), token: secret };
}

export async function revokeApiKey(apiKeyId: string) {
  const store = await readStore();
  const apiKey = store.apiKeys.find((item) => item.id === apiKeyId);

  if (!apiKey) {
    throw new Error("API Key no encontrada.");
  }

  apiKey.revokedAt = new Date().toISOString();
  await writeStore(store);
  return toPublicApiKey(apiKey);
}

export async function requireApiKey(token: string, scope: ApiKey["scopes"][number]) {
  const normalized = token.trim();

  if (!normalized.startsWith(`${TOKEN_PREFIX}_`)) {
    throw new Error("API Key invalida.");
  }

  const store = await readStore();
  const tokenHash = await hashToken(normalized);
  const apiKey = store.apiKeys.find((item) => item.tokenHash === tokenHash);

  if (!apiKey || apiKey.revokedAt || !apiKey.scopes.includes(scope)) {
    throw new Error("API Key invalida.");
  }

  apiKey.lastUsedAt = new Date().toISOString();
  await writeStore(store);
  return toPublicApiKey(apiKey);
}

async function hashToken(token: string) {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(token).digest("hex");
}
