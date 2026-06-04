import { cookies } from "next/headers";
import { nanoid } from "nanoid";
import { readStore, writeStore } from "./store";
import type { User } from "./types";

export const SESSION_COOKIE = "link_app_session";
const SESSION_DAYS = 30;

export type PublicUser = Pick<User, "id" | "name" | "email" | "role" | "workspaceName" | "createdAt" | "lastLoginAt">;

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    workspaceName: user.workspaceName,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt
  };
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  workspaceName: string;
}) {
  const store = await readStore();
  const email = input.email.toLowerCase();

  if (store.users.some((user) => user.email === email)) {
    throw new Error("Ya existe una cuenta con ese email.");
  }

  const salt = nanoid(24);
  const now = new Date().toISOString();
  const user: User = {
    id: nanoid(),
    name: input.name,
    email,
    passwordHash: await hashPassword(input.password, salt),
    passwordSalt: salt,
    role: store.users.length === 0 ? "owner" : "member",
    workspaceName: input.workspaceName || "My Workspace",
    createdAt: now,
    lastLoginAt: now
  };

  store.users.push(user);
  const sessionId = createSession(store, user.id);
  await writeStore(store);
  return { user: toPublicUser(user), sessionId };
}

export async function loginUser(input: { email: string; password: string }) {
  const store = await readStore();
  const user = store.users.find((item) => item.email === input.email.toLowerCase());

  if (!user || user.passwordHash !== (await hashPassword(input.password, user.passwordSalt))) {
    throw new Error("Email o contrasena incorrectos.");
  }

  user.lastLoginAt = new Date().toISOString();
  const sessionId = createSession(store, user.id);
  await writeStore(store);
  return { user: toPublicUser(user), sessionId };
}

export async function logoutCurrentSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionId) {
    return;
  }

  const store = await readStore();
  store.sessions = store.sessions.filter((session) => session.id !== sessionId);
  await writeStore(store);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionId) {
    return null;
  }

  const store = await readStore();
  const session = store.sessions.find(
    (item) => item.id === sessionId && new Date(item.expiresAt).getTime() > Date.now()
  );

  if (!session) {
    return null;
  }

  const user = store.users.find((item) => item.id === session.userId);
  return user ? toPublicUser(user) : null;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("No autenticado.");
  }

  return user;
}

export async function listUsers() {
  const store = await readStore();
  return store.users.map(toPublicUser).toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60
  };
}

function createSession(store: Awaited<ReturnType<typeof readStore>>, userId: string) {
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const sessionId = nanoid(40);
  store.sessions = store.sessions.filter((session) => session.userId !== userId);
  store.sessions.push({
    id: sessionId,
    userId,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString()
  });
  return sessionId;
}

async function hashPassword(password: string, salt: string) {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(`${salt}:${password}`).digest("hex");
}
