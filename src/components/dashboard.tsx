"use client";

import {
  Activity,
  BarChart3,
  CalendarClock,
  Check,
  CheckCircle2,
  Clipboard,
  Download,
  Edit3,
  ExternalLink,
  FileUp,
  Filter,
  Globe2,
  KeyRound,
  LayoutDashboard,
  Link2,
  Loader2,
  LogOut,
  MoreHorizontal,
  MousePointerClick,
  Plus,
  Power,
  QrCode,
  RefreshCw,
  Save,
  Search,
  Settings,
  Tags,
  Trash2,
  UserPlus,
  Users,
  X,
  Zap
} from "lucide-react";
import QRCode from "qrcode";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicApiKey } from "@/lib/api-keys";
import type { PublicUser } from "@/lib/auth";
import type { ClickEvent, Domain, ShortLink, Store } from "@/lib/types";
import { DEFAULT_BASE_URL } from "@/lib/config";

type Snapshot = Pick<Store, "domains" | "links" | "clickEvents">;
type Toast = { tone: "success" | "error"; text: string } | null;
type View = "overview" | "create" | "links" | "analytics" | "apiKeys" | "users" | "domains" | "imports" | "settings";
type LinkUpdateInput = Partial<Omit<ShortLink, "tags">> & { tags?: string };
type AnalyticsRow = { count: number; label: string; percent: number };
type AnalyticsInsight = { detail: string; label: string; source: string; value: string } | null;
type UserFormState = { name: string; email: string; password: string; role: PublicUser["role"] };
type DashboardStats = {
  activeLinks: number;
  clicks: number;
  links: number;
  uniqueClicks: number;
  verifiedDomains: number;
};

const ANALYTICS_COLORS = ["#4faeba", "#b8f0f5", "#3151c9", "#b8c8ff", "#f08b27", "#87d4c9"];

const emptyLinkForm = {
  title: "",
  targetUrl: "",
  slug: "",
  domainId: "base",
  tags: "",
  campaign: "",
  expiresAt: "",
  clickLimit: "",
  fallbackUrl: "",
  utmSource: "",
  utmMedium: "",
  utmCampaign: "",
  utmContent: "",
  utmTerm: ""
};

export function Dashboard({
  currentUser,
  initialApiKeys,
  initialSnapshot,
  initialUsers
}: {
  currentUser: PublicUser;
  initialApiKeys: PublicApiKey[];
  initialSnapshot: Snapshot;
  initialUsers: PublicUser[];
}) {
  const router = useRouter();
  const [domains, setDomains] = useState(initialSnapshot.domains);
  const [links, setLinks] = useState(initialSnapshot.links);
  const [clickEvents, setClickEvents] = useState(initialSnapshot.clickEvents);
  const [apiKeys, setApiKeys] = useState(initialApiKeys);
  const [users, setUsers] = useState(initialUsers);
  const [toast, setToast] = useState<Toast>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeView, setActiveView] = useState<View>("overview");
  const [linkForm, setLinkForm] = useState(emptyLinkForm);
  const [apiKeyForm, setApiKeyForm] = useState({ name: "" });
  const [newApiToken, setNewApiToken] = useState("");
  const [domainForm, setDomainForm] = useState({ hostname: "" });

  const stats = useMemo(
    () => ({
      links: links.length,
      activeLinks: links.filter((link) => link.isActive && !isExpired(link)).length,
      clicks: links.reduce((total, link) => total + link.clicks, 0),
      uniqueClicks: links.reduce((total, link) => total + link.uniqueClicks, 0),
      verifiedDomains: domains.filter((domain) => domain.status === "verified").length
    }),
    [domains, links]
  );

  const filteredLinks = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return links;
    }

    return links.filter((link) =>
      [link.title, link.slug, link.targetUrl, link.campaign, link.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [links, query]);

  async function refresh() {
    const [snapshotResponse, usersResponse, apiKeysResponse] = await Promise.all([
      fetch("/api/snapshot", { cache: "no-store" }),
      fetch("/api/users", { cache: "no-store" }),
      fetch("/api/api-keys", { cache: "no-store" })
    ]);
    const snapshot = (await snapshotResponse.json()) as Snapshot;
    const latestUsers = (await usersResponse.json()) as PublicUser[];
    const latestApiKeys = (await apiKeysResponse.json()) as PublicApiKey[];
    setDomains(snapshot.domains);
    setLinks(snapshot.links);
    setClickEvents(snapshot.clickEvents);
    setUsers(latestUsers);
    setApiKeys(latestApiKeys);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function createLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create-link");
    setToast(null);

    try {
      const response = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: linkForm.title,
          targetUrl: withUtmParams(linkForm),
          slug: linkForm.slug,
          domainId: linkForm.domainId,
          tags: linkForm.tags,
          campaign: linkForm.campaign || linkForm.utmCampaign,
          expiresAt: linkForm.expiresAt,
          clickLimit: linkForm.clickLimit ? Number(linkForm.clickLimit) : null,
          fallbackUrl: linkForm.fallbackUrl
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message);
      }

      setLinks((current) => [payload, ...current]);
      setLinkForm(emptyLinkForm);
      setActiveView("links");
      setToast({ tone: "success", text: "Link creado." });
    } catch (error) {
      setToast({ tone: "error", text: error instanceof Error ? error.message : "No se pudo crear." });
    } finally {
      setBusy(null);
    }
  }

  async function createApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create-api-key");
    setToast(null);
    setNewApiToken("");

    try {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiKeyForm)
      });
      const payload = (await response.json()) as { apiKey?: PublicApiKey; message?: string; token?: string };

      if (!response.ok || !payload.apiKey || !payload.token) {
        throw new Error(payload.message || "No se pudo crear la API Key.");
      }

      setApiKeys((current) => [payload.apiKey as PublicApiKey, ...current]);
      setApiKeyForm({ name: "" });
      setNewApiToken(payload.token);
      setToast({ tone: "success", text: "API Key creada. Copiala ahora." });
    } catch (error) {
      setToast({ tone: "error", text: error instanceof Error ? error.message : "No se pudo crear la API Key." });
    } finally {
      setBusy(null);
    }
  }

  async function createUser(input: UserFormState) {
    setBusy("create-user");
    setToast(null);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const payload = (await response.json()) as PublicUser & { message?: string };

      if (!response.ok) {
        throw new Error(payload.message || "No se pudo crear el usuario.");
      }

      setUsers((current) => [...current, payload]);
      setToast({ tone: "success", text: "Usuario creado." });
      return true;
    } catch (error) {
      setToast({ tone: "error", text: error instanceof Error ? error.message : "No se pudo crear el usuario." });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function updateUser(userId: string, input: UserFormState) {
    setBusy(`update-user-${userId}`);
    setToast(null);

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: input.name,
          email: input.email,
          password: input.password,
          role: input.role
        })
      });
      const payload = (await response.json()) as PublicUser & { message?: string };

      if (!response.ok) {
        throw new Error(payload.message || "No se pudo editar el usuario.");
      }

      setUsers((current) => current.map((user) => (user.id === payload.id ? payload : user)));
      setToast({ tone: "success", text: "Usuario actualizado." });
      return true;
    } catch (error) {
      setToast({ tone: "error", text: error instanceof Error ? error.message : "No se pudo editar el usuario." });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function revokeKey(apiKeyId: string) {
    setBusy(`revoke-api-key-${apiKeyId}`);
    setToast(null);

    try {
      const response = await fetch(`/api/api-keys/${apiKeyId}`, { method: "DELETE" });
      const payload = (await response.json()) as PublicApiKey & { message?: string };

      if (!response.ok) {
        throw new Error(payload.message || "No se pudo revocar la API Key.");
      }

      setApiKeys((current) => current.map((apiKey) => (apiKey.id === payload.id ? payload : apiKey)));
      setToast({ tone: "success", text: "API Key revocada." });
    } catch (error) {
      setToast({ tone: "error", text: error instanceof Error ? error.message : "No se pudo revocar." });
    } finally {
      setBusy(null);
    }
  }

  async function addDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create-domain");
    setToast(null);

    try {
      const response = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(domainForm)
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message);
      }

      setDomains((current) => [payload, ...current]);
      setDomainForm({ hostname: "" });
      setToast({ tone: "success", text: "Dominio anadido." });
    } catch (error) {
      setToast({ tone: "error", text: error instanceof Error ? error.message : "No se pudo anadir." });
    } finally {
      setBusy(null);
    }
  }

  async function verifyDomain(domainId: string, force = false) {
    setBusy(`verify-${domainId}`);
    setToast(null);

    try {
      const response = await fetch(`/api/domains/${domainId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message);
      }

      setDomains((current) => current.map((domain) => (domain.id === payload.id ? payload : domain)));
      setToast({ tone: "success", text: "Dominio verificado." });
    } catch (error) {
      setToast({
        tone: "error",
        text: error instanceof Error ? error.message : "No se pudo verificar."
      });
    } finally {
      setBusy(null);
    }
  }

  async function updateLink(linkId: string, input: LinkUpdateInput) {
    setBusy(`save-link-${linkId}`);
    setToast(null);

    try {
      const response = await fetch(`/api/links/${linkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message);
      }

      setLinks((current) => current.map((link) => (link.id === payload.id ? payload : link)));
      setToast({ tone: "success", text: "Link actualizado." });
    } catch (error) {
      setToast({ tone: "error", text: error instanceof Error ? error.message : "No se pudo guardar." });
    } finally {
      setBusy(null);
    }
  }

  async function deleteLink(linkId: string) {
    setBusy(`delete-link-${linkId}`);
    setToast(null);

    try {
      const response = await fetch(`/api/links/${linkId}`, { method: "DELETE" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message);
      }

      setLinks((current) => current.filter((link) => link.id !== linkId));
      setClickEvents((current) => current.filter((event) => event.linkId !== linkId));
      setToast({ tone: "success", text: "Link borrado." });
    } catch (error) {
      setToast({ tone: "error", text: error instanceof Error ? error.message : "No se pudo borrar." });
    } finally {
      setBusy(null);
    }
  }

  async function deleteDomain(domainId: string) {
    setBusy(`delete-domain-${domainId}`);
    setToast(null);

    try {
      const response = await fetch(`/api/domains/${domainId}`, { method: "DELETE" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message);
      }

      setDomains((current) => current.filter((domain) => domain.id !== domainId));
      setToast({ tone: "success", text: "Dominio borrado." });
    } catch (error) {
      setToast({ tone: "error", text: error instanceof Error ? error.message : "No se pudo borrar." });
    } finally {
      setBusy(null);
    }
  }

  async function copyShortUrl(link: ShortLink) {
    const url = buildShortUrl(link, domains);
    await navigator.clipboard.writeText(url);
    setToast({ tone: "success", text: "Copiado al portapapeles." });
  }

  return (
    <main className="dashboard-app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">
            <Link2 size={21} strokeWidth={2.4} />
          </span>
          <strong>dayibiza.link</strong>
        </div>
        <div className="workspace-switcher">
          <span>{initials(currentUser.name)}</span>
          <div>
            <strong>{currentUser.name}</strong>
            <p>{currentUser.workspaceName}</p>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Navegacion principal">
          <span className="nav-section-label">Principal</span>
          <NavButton
            icon={<LayoutDashboard size={18} />}
            active={activeView === "overview"}
            onClick={() => setActiveView("overview")}
          >
            Inicio
          </NavButton>
          <NavButton icon={<Plus size={18} />} active={activeView === "create"} onClick={() => setActiveView("create")}>
            Crear nuevo enlace
          </NavButton>
          <NavButton icon={<Link2 size={18} />} active={activeView === "links"} onClick={() => setActiveView("links")}>
            Enlaces
          </NavButton>
          <NavButton
            icon={<BarChart3 size={18} />}
            active={activeView === "analytics"}
            onClick={() => setActiveView("analytics")}
          >
            Analytics
          </NavButton>
          <span className="nav-section-label">Gestion</span>
          <NavButton
            icon={<KeyRound size={18} />}
            active={activeView === "apiKeys"}
            onClick={() => setActiveView("apiKeys")}
          >
            API Keys
          </NavButton>
          <NavButton icon={<Users size={18} />} active={activeView === "users"} onClick={() => setActiveView("users")}>
            Usuarios
          </NavButton>
          <NavButton icon={<Globe2 size={18} />} active={activeView === "domains"} onClick={() => setActiveView("domains")}>
            Dominios
          </NavButton>
          <span className="nav-section-label">Herramientas</span>
          <NavButton icon={<FileUp size={18} />} active={activeView === "imports"} onClick={() => setActiveView("imports")}>
            Importacion masiva
          </NavButton>
          <NavButton icon={<Settings size={18} />} active={activeView === "settings"} onClick={() => setActiveView("settings")}>
            Configuracion
          </NavButton>
        </nav>
        <div className="usage-box">
          <strong>Uso</strong>
          <p>{stats.links} links creados</p>
          <small>Ilimitado</small>
        </div>
        <button className="sidebar-logout" onClick={logout}>
          <LogOut size={17} />
          Salir
        </button>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <h1>{viewTitle(activeView)}</h1>
            <p>{viewSubtitle(activeView)}</p>
          </div>
          <div className="header-actions">
            {toast ? <span className={`toast ${toast.tone}`}>{toast.text}</span> : null}
            <button className="icon-button" type="button" onClick={refresh} title="Actualizar">
              <RefreshCw size={18} />
            </button>
            <button className="primary-action" type="button" onClick={() => setActiveView("create")}>
              <Plus size={18} />
              Nuevo enlace
            </button>
          </div>
        </header>

        {activeView === "overview" ? (
          <OverviewView
            apiKeys={apiKeys}
            clickEvents={clickEvents}
            currentUser={currentUser}
            domains={domains}
            links={links}
            stats={stats}
            users={users}
            onNavigate={setActiveView}
          />
        ) : null}

        {activeView === "create" ? (
          <CreateLinkView
            busy={busy}
            domains={domains}
            linkForm={linkForm}
            setLinkForm={setLinkForm}
            onSubmit={createLink}
          />
        ) : null}

        {activeView === "links" ? (
          <LinksView
            busy={busy}
            clickEvents={clickEvents}
            domains={domains}
            filteredLinks={filteredLinks}
            query={query}
            setQuery={setQuery}
            onCopy={copyShortUrl}
            onDelete={deleteLink}
            onUpdate={updateLink}
          />
        ) : null}

        {activeView === "analytics" ? (
          <AnalyticsView clickEvents={clickEvents} links={links} stats={stats} />
        ) : null}

        {activeView === "apiKeys" ? (
          <ApiKeysView
            apiKeyForm={apiKeyForm}
            apiKeys={apiKeys}
            busy={busy}
            newApiToken={newApiToken}
            setApiKeyForm={setApiKeyForm}
            onCreate={createApiKey}
            onRevoke={revokeKey}
          />
        ) : null}

        {activeView === "users" ? (
          <UsersView
            busy={busy}
            currentUser={currentUser}
            users={users}
            onCreate={createUser}
            onUpdate={updateUser}
          />
        ) : null}

        {activeView === "domains" ? (
          <DomainsView
            busy={busy}
            domainForm={domainForm}
            domains={domains}
            setDomainForm={setDomainForm}
            onAddDomain={addDomain}
            onDeleteDomain={deleteDomain}
            onForceVerify={(id) => verifyDomain(id, true)}
            onVerify={(id) => verifyDomain(id)}
          />
        ) : null}

        {activeView === "imports" ? <PlaceholderView icon={<FileUp size={24} />} title="Importacion masiva" /> : null}
        {activeView === "settings" ? <PlaceholderView icon={<Settings size={24} />} title="Configuracion" /> : null}
      </section>
    </main>
  );
}

function NavButton({
  active,
  children,
  icon,
  onClick
}: {
  active: boolean;
  children: ReactNode;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={`nav-button ${active ? "active" : ""}`} type="button" onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}

function OverviewView({
  apiKeys,
  clickEvents,
  currentUser,
  domains,
  links,
  onNavigate,
  stats,
  users
}: {
  apiKeys: PublicApiKey[];
  clickEvents: ClickEvent[];
  currentUser: PublicUser;
  domains: Domain[];
  links: ShortLink[];
  onNavigate: (view: View) => void;
  stats: DashboardStats;
  users: PublicUser[];
}) {
  const lastWeekEvents = filterAnalyticsEvents(clickEvents, "7", "all");
  const weeklyTimeline = lastNDays(lastWeekEvents, 7);
  const directCount = groupAnalytics(lastWeekEvents, (event) => readableReferrer(event.referrer)).find(
    (item) => item.label === "Directo"
  )?.count ?? 0;
  const activeApiKeys = apiKeys.filter((apiKey) => !apiKey.revokedAt).length;
  const pendingDomains = domains.filter((domain) => domain.status !== "verified").length;
  const expiredLinks = links.filter(isExpired).length;
  const recentEvents = clickEvents
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const latestLinks = links
    .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 4);
  const topLinks = links
    .map((link) => ({
      link,
      count: clickEvents.filter((event) => event.linkId === link.id).length
    }))
    .filter((item) => item.count > 0)
    .toSorted((a, b) => b.count - a.count)
    .slice(0, 4);

  return (
    <section className="overview-view">
      <div className="overview-hero">
        <div>
          <small>{currentUser.workspaceName}</small>
          <h2>Hola, {currentUser.name}</h2>
          <p>Vista general de enlaces, trafico, dominios, API Keys y usuarios.</p>
        </div>
        <div className="overview-actions">
          <button className="primary-action" type="button" onClick={() => onNavigate("create")}>
            <Plus size={18} />
            Crear enlace
          </button>
          <button className="ghost-action" type="button" onClick={() => onNavigate("analytics")}>
            <BarChart3 size={18} />
            Ver Analytics
          </button>
        </div>
      </div>

      <div className="overview-metrics">
        <OverviewMetric
          detail={`${stats.activeLinks} activos`}
          icon={<Link2 size={20} />}
          label="Links"
          value={stats.links}
        />
        <OverviewMetric
          detail={`${stats.uniqueClicks} visitantes unicos`}
          icon={<MousePointerClick size={20} />}
          label="Clics totales"
          value={stats.clicks}
        />
        <OverviewMetric
          detail={`${domains.length} dominios conectados`}
          icon={<Globe2 size={20} />}
          label="Dominios verificados"
          value={stats.verifiedDomains}
        />
        <OverviewMetric
          detail={`${activeApiKeys} activas`}
          icon={<KeyRound size={20} />}
          label="API Keys"
          value={apiKeys.length}
        />
      </div>

      <div className="overview-grid">
        <article className="overview-panel overview-panel-wide">
          <div className="overview-panel-head">
            <div>
              <small>Ultimos 7 dias</small>
              <h3>Actividad general</h3>
            </div>
            <strong>{lastWeekEvents.length} clics</strong>
          </div>
          <MiniSparkline data={weeklyTimeline} />
          <div className="overview-chip-row">
            <span>{directCount} directos</span>
            <span>{lastWeekEvents.length ? Math.round((directCount / lastWeekEvents.length) * 100) : 0}% directo</span>
            <span>{clickEvents.length} eventos historicos</span>
          </div>
        </article>

        <article className="overview-panel">
          <div className="overview-panel-head">
            <div>
              <small>Ranking</small>
              <h3>Top links</h3>
            </div>
            <button className="icon-button subtle" type="button" title="Ver enlaces" onClick={() => onNavigate("links")}>
              <ExternalLink size={16} />
            </button>
          </div>
          <OverviewList
            emptyText="Aun no hay clics en enlaces."
            rows={topLinks.map((item) => ({
              label: item.link.title,
              meta: `/${item.link.slug}`,
              value: `${item.count}`
            }))}
          />
        </article>

        <article className="overview-panel">
          <div className="overview-panel-head">
            <div>
              <small>Workspace</small>
              <h3>Estado</h3>
            </div>
            <Activity size={19} />
          </div>
          <div className="overview-status-list">
            <OverviewStatus label="Links activos" value={`${stats.activeLinks}/${stats.links}`} tone="good" />
            <OverviewStatus label="Links expirados" value={String(expiredLinks)} tone={expiredLinks ? "warn" : "good"} />
            <OverviewStatus
              label="Dominios pendientes"
              value={String(pendingDomains)}
              tone={pendingDomains ? "warn" : "good"}
            />
            <OverviewStatus label="Usuarios" value={String(users.length)} tone="neutral" />
          </div>
        </article>

        <article className="overview-panel">
          <div className="overview-panel-head">
            <div>
              <small>Recientes</small>
              <h3>Ultima actividad</h3>
            </div>
            <button className="icon-button subtle" type="button" title="Ver Analytics" onClick={() => onNavigate("analytics")}>
              <BarChart3 size={16} />
            </button>
          </div>
          <OverviewList
            emptyText="Todavia no hay actividad."
            rows={recentEvents.map((event) => ({
              label: event.slug,
              meta: `${countryName(event.country)} · ${readableReferrer(event.referrer)}`,
              value: formatDate(event.createdAt)
            }))}
          />
        </article>

        <article className="overview-panel">
          <div className="overview-panel-head">
            <div>
              <small>Actualizados</small>
              <h3>Enlaces recientes</h3>
            </div>
            <button className="icon-button subtle" type="button" title="Ver enlaces" onClick={() => onNavigate("links")}>
              <Link2 size={16} />
            </button>
          </div>
          <OverviewList
            emptyText="Crea tu primer enlace."
            rows={latestLinks.map((link) => ({
              label: link.title,
              meta: buildShortUrl(link, domains),
              value: link.isActive && !isExpired(link) ? "Activo" : "Pausado"
            }))}
          />
        </article>
      </div>
    </section>
  );
}

function OverviewMetric({
  detail,
  icon,
  label,
  value
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <article className="overview-metric">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
    </article>
  );
}

function MiniSparkline({ data }: { data: { count: number; label: string }[] }) {
  const max = Math.max(1, ...data.map((item) => item.count));

  return (
    <div className="mini-sparkline" aria-label="Actividad de los ultimos 7 dias">
      {data.map((item) => (
        <span key={item.label} title={`${item.label}: ${item.count}`}>
          <i style={{ height: `${Math.max(8, (item.count / max) * 100)}%` }} />
          <small>{item.label}</small>
        </span>
      ))}
    </div>
  );
}

function OverviewList({
  emptyText,
  rows
}: {
  emptyText: string;
  rows: { label: string; meta: string; value: string }[];
}) {
  if (!rows.length) {
    return <EmptyState text={emptyText} />;
  }

  return (
    <div className="overview-list">
      {rows.map((row) => (
        <div key={`${row.label}-${row.meta}`}>
          <span>
            <strong>{row.label}</strong>
            <small>{row.meta}</small>
          </span>
          <em>{row.value}</em>
        </div>
      ))}
    </div>
  );
}

function OverviewStatus({ label, tone, value }: { label: string; tone: "good" | "neutral" | "warn"; value: string }) {
  return (
    <div className={`overview-status ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CreateLinkView({
  busy,
  domains,
  linkForm,
  setLinkForm,
  onSubmit
}: {
  busy: string | null;
  domains: Domain[];
  linkForm: typeof emptyLinkForm;
  setLinkForm: React.Dispatch<React.SetStateAction<typeof emptyLinkForm>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const selectedDomain = domains.find((domain) => domain.id === linkForm.domainId);
  const previewHost = selectedDomain?.hostname || DEFAULT_BASE_URL.replace(/^https?:\/\//, "");
  const previewSlug = linkForm.slug.trim() || "nuevo-link";
  const previewUrl = `https://${previewHost}/${previewSlug}`;
  const targetHost = safeHostname(linkForm.targetUrl);
  const hasTracking = Boolean(
    linkForm.utmSource ||
      linkForm.utmMedium ||
      linkForm.utmCampaign ||
      linkForm.utmContent ||
      linkForm.utmTerm ||
      linkForm.campaign ||
      linkForm.tags
  );
  const hasRules = Boolean(linkForm.expiresAt || linkForm.clickLimit || linkForm.fallbackUrl);

  return (
    <div className="create-layout">
      <section className="link-builder">
        <form className="form-stack" onSubmit={onSubmit}>
          <div className="create-step destination-card">
            <span className="step-kicker">Paso 1</span>
            <label>
              <span>
                <Link2 size={16} />
                Destino
              </span>
              <input
                required
                placeholder="https://www.example.com"
                value={linkForm.targetUrl}
                onChange={(event) =>
                  setLinkForm((current) => ({ ...current, targetUrl: event.target.value }))
                }
              />
            </label>
            <p>{targetHost ? `Destino detectado: ${targetHost}` : "Pega cualquier URL larga para empezar."}</p>
          </div>

          <div className="create-step">
            <div className="step-heading">
              <span className="step-kicker">Paso 2</span>
              <h2>Link corto</h2>
            </div>
            <div className="form-row">
              <label>
                Slug
                <input
                  placeholder="verano"
                  value={linkForm.slug}
                  onChange={(event) => setLinkForm((current) => ({ ...current, slug: event.target.value }))}
                />
              </label>
              <label>
                Dominio
                <select
                  value={linkForm.domainId}
                  onChange={(event) => setLinkForm((current) => ({ ...current, domainId: event.target.value }))}
                >
                  <option value="base">dayibiza.link</option>
                  {domains
                    .filter((domain) => domain.status === "verified")
                    .map((domain) => (
                      <option key={domain.id} value={domain.id}>
                        {domain.hostname}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div className="live-short-url">
              <Link2 size={15} />
              <span>{previewUrl}</span>
            </div>
          </div>

          <div className="create-step">
            <div className="step-heading">
              <span className="step-kicker">Paso 3</span>
              <h2>Organizacion</h2>
            </div>
            <label>
              Nombre interno
              <input
                placeholder="ej. Mi campana"
                value={linkForm.title}
                onChange={(event) => setLinkForm((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
            <div className="form-row">
              <label>
                Campana
                <input
                  placeholder="launch"
                  value={linkForm.campaign}
                  onChange={(event) => setLinkForm((current) => ({ ...current, campaign: event.target.value }))}
                />
              </label>
              <label>
                Tags
                <input
                  placeholder="ads, newsletter"
                  value={linkForm.tags}
                  onChange={(event) => setLinkForm((current) => ({ ...current, tags: event.target.value }))}
                />
              </label>
            </div>
          </div>

          <details className="create-step advanced-step" open={hasTracking}>
            <summary>
              <span>
                <Activity size={16} />
                Seguimiento UTM
              </span>
              <em>{hasTracking ? "Configurado" : "Opcional"}</em>
            </summary>
            <div className="compact-grid">
              {(["utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm"] as const).map((key) => (
                <input
                  key={key}
                  placeholder={camelToUtm(key)}
                  value={linkForm[key]}
                  onChange={(event) => setLinkForm((current) => ({ ...current, [key]: event.target.value }))}
                />
              ))}
            </div>
          </details>

          <details className="create-step advanced-step" open={hasRules}>
            <summary>
              <span>
                <Power size={16} />
                Reglas de acceso
              </span>
              <em>{hasRules ? "Configurado" : "Opcional"}</em>
            </summary>
            <div className="form-row">
              <label>
                Expira
                <input
                  type="datetime-local"
                  value={linkForm.expiresAt}
                  onChange={(event) => setLinkForm((current) => ({ ...current, expiresAt: event.target.value }))}
                />
              </label>
              <label>
                Limite clics
                <input
                  min="1"
                  type="number"
                  placeholder="500"
                  value={linkForm.clickLimit}
                  onChange={(event) => setLinkForm((current) => ({ ...current, clickLimit: event.target.value }))}
                />
              </label>
            </div>
            <label>
              URL fallback
              <input
                placeholder="https://ejemplo.com/cerrado"
                value={linkForm.fallbackUrl}
                onChange={(event) => setLinkForm((current) => ({ ...current, fallbackUrl: event.target.value }))}
              />
            </label>
          </details>

          <button className="primary-button" disabled={busy === "create-link"}>
            {busy === "create-link" ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
            Guardar enlace
          </button>
        </form>
      </section>
      <aside className="preview-rail">
        <div className="create-preview-card">
          <span className="preview-domain">{previewHost}</span>
          <strong>/{previewSlug}</strong>
          <p>{linkForm.title || "Nombre interno del enlace"}</p>
          <div className="preview-status-row">
            <span>{targetHost || "Destino pendiente"}</span>
            <span>{hasTracking ? "Tracking activo" : "Sin UTM"}</span>
          </div>
        </div>
        <div className="qr-placeholder">
          <QrCode size={50} />
          <span>El QR aparecera al guardar</span>
        </div>
        <div className="preview-checklist">
          <strong>Listo para crear</strong>
          <span className={linkForm.targetUrl ? "done" : ""}>
            <CheckCircle2 size={15} />
            URL destino
          </span>
          <span className={linkForm.slug ? "done" : ""}>
            <CheckCircle2 size={15} />
            Slug personalizado
          </span>
          <span className={hasRules ? "done" : ""}>
            <CheckCircle2 size={15} />
            Reglas opcionales
          </span>
        </div>
      </aside>
    </div>
  );
}

function LinksView({
  busy,
  clickEvents,
  domains,
  filteredLinks,
  query,
  setQuery,
  onCopy,
  onDelete,
  onUpdate
}: {
  busy: string | null;
  clickEvents: ClickEvent[];
  domains: Domain[];
  filteredLinks: ShortLink[];
  query: string;
  setQuery: (value: string) => void;
  onCopy: (link: ShortLink) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, input: LinkUpdateInput) => Promise<void>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused" | "expired">("all");
  const activeCount = filteredLinks.filter((link) => link.isActive && !isExpired(link)).length;
  const pausedCount = filteredLinks.filter((link) => !link.isActive).length;
  const expiredCount = filteredLinks.filter(isExpired).length;
  const visibleLinks = filteredLinks.filter((link) => {
    if (statusFilter === "active") {
      return link.isActive && !isExpired(link);
    }
    if (statusFilter === "paused") {
      return !link.isActive;
    }
    if (statusFilter === "expired") {
      return isExpired(link);
    }
    return true;
  });

  return (
    <section className="links-view">
      <div className="link-command-center">
        <div>
          <small>Centro de enlaces</small>
          <h2>{filteredLinks.length} links</h2>
          <p>{activeCount} activos · {pausedCount} pausados · {expiredCount} expirados</p>
        </div>
        <div className="link-command-actions">
          <label className="search-field">
            <Search size={16} />
            <input placeholder="Buscar por nombre, slug, destino o tag..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <button className="ghost-action" type="button">
            <Download size={16} />
            Exportar
          </button>
        </div>
      </div>

      <div className="link-filter-tabs" role="tablist" aria-label="Filtros de enlaces">
        <button className={statusFilter === "all" ? "active" : ""} type="button" onClick={() => setStatusFilter("all")}>
          Todos <span>{filteredLinks.length}</span>
        </button>
        <button className={statusFilter === "active" ? "active" : ""} type="button" onClick={() => setStatusFilter("active")}>
          Activos <span>{activeCount}</span>
        </button>
        <button className={statusFilter === "paused" ? "active" : ""} type="button" onClick={() => setStatusFilter("paused")}>
          Pausados <span>{pausedCount}</span>
        </button>
        <button className={statusFilter === "expired" ? "active" : ""} type="button" onClick={() => setStatusFilter("expired")}>
          Expirados <span>{expiredCount}</span>
        </button>
      </div>

      <div className="link-table link-card-list">
        {visibleLinks.length === 0 ? (
          <EmptyState text="Sin resultados para este filtro" />
        ) : (
          visibleLinks.map((link) => (
            <div className="link-list-card" key={link.id}>
              <button className="link-row" type="button" onClick={() => setExpandedId(expandedId === link.id ? null : link.id)}>
                <span className="link-name">
                  <span className="favicon-dot">{safeHostname(link.targetUrl).slice(0, 1).toUpperCase() || "L"}</span>
                  <span>
                    <strong>{link.title}</strong>
                    <small>{safeHostname(link.targetUrl) || link.targetUrl}</small>
                  </span>
                </span>
                <span className="link-row-metric">
                  <small>Hoy</small>
                  <strong>{clicksToday(clickEvents, link.id)}</strong>
                </span>
                <span className="link-row-metric">
                  <small>Total</small>
                  <strong>{link.clicks}</strong>
                </span>
                <span className="short-url">{buildShortUrl(link, domains)}</span>
                <span className="row-actions">
                  <StatusBadge link={link} />
                  <Edit3 size={15} />
                </span>
              </button>
              {expandedId === link.id ? (
                <LinkItem
                  busy={busy}
                  domains={domains}
                  events={clickEvents.filter((event) => event.linkId === link.id)}
                  link={link}
                  onCopy={() => onCopy(link)}
                  onDelete={() => onDelete(link.id)}
                  onUpdate={(input) => onUpdate(link.id, input)}
                />
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
function AnalyticsView({
  clickEvents,
  links,
  stats
}: {
  clickEvents: ClickEvent[];
  links: ShortLink[];
  stats: { clicks: number; uniqueClicks: number };
}) {
  const [range, setRange] = useState("30");
  const [selectedLinkId, setSelectedLinkId] = useState("all");
  const [activeInsight, setActiveInsight] = useState<AnalyticsInsight>(null);
  const filteredEvents = useMemo(
    () => filterAnalyticsEvents(clickEvents, range, selectedLinkId),
    [clickEvents, range, selectedLinkId]
  );
  const rangeDays = range === "all" ? 30 : Number(range);
  const timeline = lastNDays(filteredEvents, Math.min(30, rangeDays));
  const total = filteredEvents.length;
  const unique = new Set(filteredEvents.map((event) => event.ipHash)).size;
  const topReferrers = groupAnalytics(filteredEvents, (event) => readableReferrer(event.referrer)).slice(0, 7);
  const topCountries = groupAnalytics(filteredEvents, (event) => countryName(event.country)).slice(0, 10);
  const topDevices = groupAnalytics(filteredEvents, (event) => deviceName(event.device)).slice(0, 5);
  const topBrowsers = groupAnalytics(filteredEvents, (event) => event.browser || "Other").slice(0, 5);
  const topCampaigns = groupAnalytics(filteredEvents, (event) => {
    const link = links.find((item) => item.id === event.linkId);
    return link?.campaign || "Sin campana";
  }).slice(0, 5);
  const topLinks = links
    .map((link) => ({
      link,
      count: filteredEvents.filter((event) => event.linkId === link.id).length
    }))
    .filter((item) => item.count > 0)
    .toSorted((a, b) => b.count - a.count)
    .slice(0, 6);
  const bestDay = timeline.toSorted((a, b) => b.count - a.count)[0];
  const directCount = topReferrers.find((item) => item.label === "Directo")?.count ?? 0;

  return (
    <section className="analytics-view">
      <div className="analytics-toolbar">
        <div className="button-row">
          <label className="select-control">
            <CalendarClock size={17} />
            <select value={range} onChange={(event) => setRange(event.target.value)}>
              <option value="7">Ultimos 7 dias</option>
              <option value="30">Ultimos 30 dias</option>
              <option value="90">Ultimos 90 dias</option>
              <option value="all">Todo el historico</option>
            </select>
          </label>
          <label className="select-control">
            <Filter size={17} />
            <select value={selectedLinkId} onChange={(event) => setSelectedLinkId(event.target.value)}>
              <option value="all">Todos los links</option>
              {links.map((link) => (
                <option key={link.id} value={link.id}>
                  {link.title || link.slug}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="ghost-action" type="button" onClick={() => downloadAnalyticsCsv(filteredEvents, links)}>
          <Download size={17} />
          Exportar CSV
        </button>
      </div>

      <div className="analytics-kpis">
        <KpiCard
          label="Interacciones filtradas"
          value={total}
          detail={`${stats.clicks} clics historicos`}
          onInspect={() =>
            setActiveInsight({
              source: "Resumen",
              label: "Interacciones filtradas",
              value: String(total),
              detail: "Total de eventos dentro de los filtros actuales."
            })
          }
        />
        <KpiCard
          label="Visitantes unicos"
          value={unique}
          detail={`${stats.uniqueClicks} unicos historicos`}
          onInspect={() =>
            setActiveInsight({
              source: "Resumen",
              label: "Visitantes unicos",
              value: String(unique),
              detail: "Calculado por hash de IP dentro del periodo seleccionado."
            })
          }
        />
        <KpiCard
          label="Mejor dia"
          value={bestDay?.count ?? 0}
          detail={bestDay ? bestDay.label : "Sin datos"}
          onInspect={() =>
            setActiveInsight({
              source: "Resumen",
              label: bestDay ? `Mejor dia: ${bestDay.label}` : "Mejor dia",
              value: String(bestDay?.count ?? 0),
              detail: "Dia con mas interacciones en el grafico actual."
            })
          }
        />
        <KpiCard
          label="Trafico directo"
          value={`${total ? Math.round((directCount / total) * 100) : 0}%`}
          detail={`${directCount} interacciones`}
          onInspect={() =>
            setActiveInsight({
              source: "Resumen",
              label: "Trafico directo",
              value: `${total ? Math.round((directCount / total) * 100) : 0}%`,
              detail: `${directCount} interacciones sin referente detectado.`
            })
          }
        />
      </div>

      <div className="analytics-insight" aria-live="polite">
        <div>
          <small>{activeInsight ? activeInsight.source : "Panel interactivo"}</small>
          <strong>{activeInsight ? activeInsight.label : "Selecciona cualquier grafico para ver el detalle"}</strong>
          <span>{activeInsight ? activeInsight.detail : "Puntos, barras, filas y leyendas responden al hover y al clic."}</span>
        </div>
        <em>{activeInsight ? activeInsight.value : `${total} eventos`}</em>
        {activeInsight ? (
          <button className="icon-button subtle" type="button" title="Limpiar seleccion" onClick={() => setActiveInsight(null)}>
            <X size={16} />
          </button>
        ) : null}
      </div>

      <div className="analytics-grid">
        <AnalyticsCard className="analytics-card-wide" title="Total de interacciones a lo largo del tiempo">
          <TimelineChart
            data={timeline}
            onInspect={(item) =>
              setActiveInsight({
                source: "Tiempo",
                label: item.label,
                value: String(item.count),
                detail: "Interacciones registradas en este dia."
              })
            }
          />
        </AnalyticsCard>

        <AnalyticsCard title="Links con mas interacciones">
          <TopLinksPanel
            items={topLinks}
            total={total}
            onInspect={(item) =>
              setActiveInsight({
                source: "Links",
                label: item.link.title,
                value: String(item.count),
                detail: `${total ? Math.round((item.count / total) * 100) : 0}% de las interacciones filtradas.`
              })
            }
          />
        </AnalyticsCard>

        <AnalyticsCard title="Total de interacciones por referente">
          <BarRanking
            rows={topReferrers}
            emptyText="Aun no hay referentes."
            onInspect={(row) =>
              setActiveInsight({
                source: "Referente",
                label: row.label,
                value: String(row.count),
                detail: `${row.percent}% de las interacciones filtradas.`
              })
            }
          />
        </AnalyticsCard>

        <AnalyticsCard title="Total de interacciones por dispositivo">
          <DonutBreakdown
            rows={topDevices}
            total={total}
            centerLabel={String(total)}
            onInspect={(row) =>
              setActiveInsight({
                source: "Dispositivo",
                label: row.label,
                value: String(row.count),
                detail: `${row.percent}% de las interacciones filtradas.`
              })
            }
          />
        </AnalyticsCard>

        <AnalyticsCard className="analytics-card-wide" title="Total de interacciones por ubicacion">
          <LocationPanel
            rows={topCountries}
            total={total}
            onInspect={(row) =>
              setActiveInsight({
                source: "Ubicacion",
                label: row.label,
                value: String(row.count),
                detail: `${row.percent}% de las interacciones filtradas.`
              })
            }
          />
        </AnalyticsCard>

        <AnalyticsCard title="Navegadores">
          <BarRanking
            rows={topBrowsers}
            emptyText="Aun no hay navegadores."
            onInspect={(row) =>
              setActiveInsight({
                source: "Navegador",
                label: row.label,
                value: String(row.count),
                detail: `${row.percent}% de las interacciones filtradas.`
              })
            }
          />
        </AnalyticsCard>

        <AnalyticsCard title="Campanas">
          <BarRanking
            rows={topCampaigns}
            emptyText="Aun no hay campanas."
            onInspect={(row) =>
              setActiveInsight({
                source: "Campana",
                label: row.label,
                value: String(row.count),
                detail: `${row.percent}% de las interacciones filtradas.`
              })
            }
          />
        </AnalyticsCard>
      </div>
    </section>
  );
}

function AnalyticsCard({
  children,
  className = "",
  title
}: {
  children: ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <article className={`analytics-card ${className}`}>
      <div className="analytics-card-head">
        <span className="drag-dots" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <h2>{title}</h2>
        <button className="icon-button subtle" type="button" title="Mas opciones">
          <MoreHorizontal size={18} />
        </button>
      </div>
      {children}
    </article>
  );
}

function KpiCard({
  detail,
  label,
  onInspect,
  value
}: {
  detail: string;
  label: string;
  onInspect: () => void;
  value: number | string;
}) {
  return (
    <button className="analytics-kpi" type="button" onClick={onInspect}>
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{detail}</span>
    </button>
  );
}

function TimelineChart({
  data,
  onInspect
}: {
  data: { count: number; label: string }[];
  onInspect: (item: { count: number; label: string }) => void;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = 720;
  const height = 260;
  const padding = 34;
  const max = Math.max(1, ...data.map((item) => item.count));
  const activeItem = activeIndex === null ? null : data[activeIndex];
  const points = data
    .map((item, index) => {
      const x = padding + (index / Math.max(1, data.length - 1)) * (width - padding * 2);
      const y = height - padding - (item.count / max) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="timeline-chart">
      {activeItem ? (
        <div
          className="chart-tooltip"
          style={{ left: `${(activeIndex! / Math.max(1, data.length - 1)) * 100}%` }}
        >
          <strong>{activeItem.count}</strong>
          <span>{activeItem.label}</span>
        </div>
      ) : null}
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Interacciones a lo largo del tiempo">
        {[0, 1, 2].map((line) => {
          const y = padding + line * ((height - padding * 2) / 2);
          return <line key={line} x1={padding} x2={width - padding} y1={y} y2={y} />;
        })}
        <polyline points={points} />
        {data.map((item, index) => {
          const x = padding + (index / Math.max(1, data.length - 1)) * (width - padding * 2);
          const y = height - padding - (item.count / max) * (height - padding * 2);
          return (
            <circle
              className={activeIndex === index ? "active" : ""}
              key={`${item.label}-${index}`}
              cx={x}
              cy={y}
              r="5"
              role="button"
              tabIndex={0}
              onClick={() => {
                setActiveIndex(index);
                onInspect(item);
              }}
              onFocus={() => setActiveIndex(index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onInspect(item);
                }
              }}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            />
          );
        })}
      </svg>
      <div className="timeline-labels">
        {data.map((item, index) =>
          index % Math.ceil(data.length / 8) === 0 || index === data.length - 1 ? (
            <span key={item.label}>{item.label}</span>
          ) : null
        )}
      </div>
    </div>
  );
}

function BarRanking({
  emptyText,
  onInspect,
  rows
}: {
  emptyText: string;
  onInspect: (row: AnalyticsRow) => void;
  rows: AnalyticsRow[];
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  if (!rows.length) {
    return <EmptyState text={emptyText} />;
  }

  return (
    <div className="bar-ranking">
      {rows.map((row) => (
        <button
          className={`bar-row ${activeLabel === row.label ? "active" : ""}`}
          key={row.label}
          type="button"
          onClick={() => {
            setActiveLabel(row.label);
            onInspect(row);
          }}
          onMouseEnter={() => setActiveLabel(row.label)}
          onMouseLeave={() => setActiveLabel(null)}
        >
          <span>{row.label}</span>
          <strong>{row.count}</strong>
          <em>{row.percent}%</em>
          <i style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} />
        </button>
      ))}
    </div>
  );
}

function DonutBreakdown({
  centerLabel,
  onInspect,
  rows,
  total
}: {
  centerLabel: string;
  onInspect: (row: AnalyticsRow) => void;
  rows: AnalyticsRow[];
  total: number;
}) {
  const [activeLabel, setActiveLabel] = useState(rows[0]?.label ?? "");

  if (!rows.length) {
    return <EmptyState text="Aun no hay datos de dispositivo." />;
  }

  return (
    <div className="donut-breakdown">
      <button
        className="analytics-donut"
        style={{ background: donutGradient(rows, total) }}
        type="button"
        onClick={() => onInspect(rows.find((row) => row.label === activeLabel) ?? rows[0])}
      >
        <span>{rows.find((row) => row.label === activeLabel)?.count ?? centerLabel}</span>
        <small>{activeLabel || "Total"}</small>
      </button>
      <div className="donut-legend">
        {rows.map((row, index) => (
          <button
            className={activeLabel === row.label ? "active" : ""}
            key={row.label}
            type="button"
            onClick={() => {
              setActiveLabel(row.label);
              onInspect(row);
            }}
            onMouseEnter={() => setActiveLabel(row.label)}
          >
            <i style={{ background: ANALYTICS_COLORS[index % ANALYTICS_COLORS.length] }} />
            {row.label}
            <strong>{row.count}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function LocationPanel({
  onInspect,
  rows,
  total
}: {
  onInspect: (row: AnalyticsRow) => void;
  rows: AnalyticsRow[];
  total: number;
}) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  if (!rows.length) {
    return <EmptyState text="Aun no hay ubicaciones registradas." />;
  }

  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <div className="location-panel location-panel-list">
      <div className="location-table">
        <div>
          <span>#</span>
          <span>Pais</span>
          <span>Interacciones</span>
          <span>%</span>
          <span aria-hidden="true" />
        </div>
        {rows.map((row, index) => (
          <button
            className={activeLabel === row.label ? "active" : ""}
            key={row.label}
            type="button"
            onClick={() => {
              setActiveLabel(row.label);
              onInspect(row);
            }}
            onMouseEnter={() => setActiveLabel(row.label)}
            onMouseLeave={() => setActiveLabel(null)}
          >
            <strong>{index + 1}</strong>
            <span>{row.label}</span>
            <span>{row.count}</span>
            <span>{total ? row.percent : 0}%</span>
            <i style={{ width: `${Math.max(6, (row.count / max) * 100)}%` }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function TopLinksPanel({
  items,
  onInspect,
  total
}: {
  items: { count: number; link: ShortLink }[];
  onInspect: (item: { count: number; link: ShortLink }) => void;
  total: number;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  if (!items.length) {
    return <EmptyState text="Aun no hay interacciones en links." />;
  }

  return (
    <div className="top-links-panel">
      {items.map(({ count, link }) => (
        <button
          className={activeId === link.id ? "active" : ""}
          key={link.id}
          type="button"
          onClick={() => {
            setActiveId(link.id);
            onInspect({ count, link });
          }}
          onMouseEnter={() => setActiveId(link.id)}
          onMouseLeave={() => setActiveId(null)}
        >
          <span>
            <strong>{link.title}</strong>
            <small>/{link.slug}</small>
          </span>
          <em>{count}</em>
          <i style={{ width: `${total ? Math.max(4, (count / total) * 100) : 0}%` }} />
        </button>
      ))}
    </div>
  );
}

function ApiKeysView({
  apiKeyForm,
  apiKeys,
  busy,
  newApiToken,
  setApiKeyForm,
  onCreate,
  onRevoke
}: {
  apiKeyForm: { name: string };
  apiKeys: PublicApiKey[];
  busy: string | null;
  newApiToken: string;
  setApiKeyForm: (value: { name: string }) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onRevoke: (id: string) => void;
}) {
  const [endpoint, setEndpoint] = useState("https://dayibiza.link/api/v1/links");

  useEffect(() => {
    setEndpoint(`${window.location.origin}/api/v1/links`);
  }, []);

  return (
    <section className="api-keys-view">
      <div className="api-key-hero">
        <div>
          <KeyRound size={28} />
          <h2>API Keys</h2>
          <p>Conexion remota para crear enlaces desde otros proyectos, automatizaciones o MCP.</p>
        </div>
        <div className="api-endpoint">
          <span>POST</span>
          <code>{endpoint}</code>
          <button
            className="icon-button subtle"
            type="button"
            title="Copiar endpoint"
            onClick={() => navigator.clipboard.writeText(endpoint)}
          >
            <Clipboard size={16} />
          </button>
        </div>
      </div>

      {newApiToken ? (
        <div className="api-token-reveal">
          <div>
            <strong>Token creado</strong>
            <p>Copialo ahora. Despues solo se mostrara el prefijo.</p>
          </div>
          <code>{newApiToken}</code>
          <button className="small-button" type="button" onClick={() => navigator.clipboard.writeText(newApiToken)}>
            <Clipboard size={15} />
            Copiar
          </button>
        </div>
      ) : null}

      <div className="api-key-layout">
        <form className="dashboard-card api-key-form" onSubmit={onCreate}>
          <div className="section-heading">
            <div>
              <h2>Nueva API Key</h2>
              <p>Crea una clave para integraciones externas.</p>
            </div>
          </div>
          <label>
            Nombre
            <input
              required
              minLength={2}
              placeholder="MCP, n8n, CRM..."
              value={apiKeyForm.name}
              onChange={(event) => setApiKeyForm({ name: event.target.value })}
            />
          </label>
          <button className="primary-action" disabled={busy === "create-api-key"}>
            {busy === "create-api-key" ? <Loader2 className="spin" size={18} /> : <KeyRound size={18} />}
            Generar API Key
          </button>
        </form>

        <div className="dashboard-card api-doc-card">
          <div className="section-heading">
            <div>
              <h2>Crear link por API</h2>
              <p>Autenticacion Bearer y JSON.</p>
            </div>
          </div>
          <pre>{`Authorization: Bearer <API_KEY>
Content-Type: application/json

{
  "targetUrl": "https://example.com",
  "title": "Campana externa",
  "slug": "campana",
  "domainId": "base",
  "tags": "mcp, api",
  "campaign": "externa"
}`}</pre>
        </div>
      </div>

      <div className="dashboard-card api-key-table">
        <div className="api-key-head">
          <span>Nombre</span>
          <span>Prefijo</span>
          <span>Ultimo uso</span>
          <span>Estado</span>
          <span />
        </div>
        {apiKeys.length ? (
          apiKeys.map((apiKey) => (
            <div className="api-key-row" key={apiKey.id}>
              <strong>{apiKey.name}</strong>
              <code>{apiKey.prefix}...</code>
              <span>{apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : "-"}</span>
              <span className={`status-badge ${apiKey.revokedAt ? "paused" : "active"}`}>
                {apiKey.revokedAt ? "Revocada" : "Activa"}
              </span>
              <button
                className="small-button ghost"
                disabled={Boolean(apiKey.revokedAt) || busy === `revoke-api-key-${apiKey.id}`}
                type="button"
                onClick={() => onRevoke(apiKey.id)}
              >
                {busy === `revoke-api-key-${apiKey.id}` ? <Loader2 className="spin" size={15} /> : <Trash2 size={15} />}
                Revocar
              </button>
            </div>
          ))
        ) : (
          <EmptyState text="Aun no hay API Keys." />
        )}
      </div>
    </section>
  );
}

function UsersView({
  busy,
  currentUser,
  users,
  onCreate,
  onUpdate
}: {
  busy: string | null;
  currentUser: PublicUser;
  users: PublicUser[];
  onCreate: (input: UserFormState) => Promise<boolean>;
  onUpdate: (userId: string, input: UserFormState) => Promise<boolean>;
}) {
  const canManageUsers = currentUser.role === "owner";
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>({
    name: "",
    email: "",
    password: "",
    role: "member"
  });
  const [editForm, setEditForm] = useState<UserFormState>({
    name: "",
    email: "",
    password: "",
    role: "member"
  });

  async function submitCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await onCreate(userForm);

    if (ok) {
      setUserForm({ name: "", email: "", password: "", role: "member" });
      setShowCreateForm(false);
    }
  }

  async function submitUpdateUser(event: FormEvent<HTMLFormElement>, userId: string) {
    event.preventDefault();
    const ok = await onUpdate(userId, editForm);

    if (ok) {
      setEditingUserId(null);
      setEditForm({ name: "", email: "", password: "", role: "member" });
    }
  }

  function startEdit(user: PublicUser) {
    setEditingUserId(user.id);
    setEditForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role
    });
  }

  return (
    <section className="dashboard-card">
      <div className="section-heading">
        <div>
          <h2>Usuarios en {currentUser.workspaceName}</h2>
          <p>Crea usuarios privados con email y contrasena inicial.</p>
        </div>
        <button
          className="primary-action"
          disabled={!canManageUsers}
          type="button"
          onClick={() => setShowCreateForm((value) => !value)}
        >
          <UserPlus size={18} />
          {showCreateForm ? "Cerrar" : "Invitar usuario"}
        </button>
      </div>
      {!canManageUsers ? (
        <div className="notice-inline">Solo los usuarios owner pueden crear o editar usuarios.</div>
      ) : null}
      {showCreateForm ? (
        <form className="user-editor user-editor-create" onSubmit={submitCreateUser}>
          <label>
            Nombre
            <input
              required
              minLength={2}
              value={userForm.name}
              onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label>
            Email
            <input
              required
              type="email"
              value={userForm.email}
              onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label>
            Contrasena inicial
            <input
              required
              minLength={8}
              type="password"
              value={userForm.password}
              onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
            />
          </label>
          <label>
            Rol
            <select
              value={userForm.role}
              onChange={(event) =>
                setUserForm((current) => ({ ...current, role: event.target.value as PublicUser["role"] }))
              }
            >
              <option value="member">Member</option>
              <option value="owner">Owner</option>
            </select>
          </label>
          <button className="primary-action" disabled={busy === "create-user"} type="submit">
            {busy === "create-user" ? <Loader2 className="spin" size={18} /> : <UserPlus size={18} />}
            Crear usuario
          </button>
        </form>
      ) : null}
      <div className="users-table">
        <div className="users-head">
          <span>Correo electronico</span>
          <span>Rol</span>
          <span>Ultima actividad</span>
          <span />
        </div>
        {users.map((user) => (
          <div className="users-row" key={user.id}>
            {editingUserId === user.id ? (
              <form className="user-editor user-editor-inline" onSubmit={(event) => submitUpdateUser(event, user.id)}>
                <label>
                  Nombre
                  <input
                    required
                    minLength={2}
                    value={editForm.name}
                    onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </label>
                <label>
                  Email
                  <input
                    required
                    type="email"
                    value={editForm.email}
                    onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
                  />
                </label>
                <label>
                  Nueva contrasena
                  <input
                    minLength={8}
                    placeholder="Dejar vacia"
                    type="password"
                    value={editForm.password}
                    onChange={(event) => setEditForm((current) => ({ ...current, password: event.target.value }))}
                  />
                </label>
                <label>
                  Rol
                  <select
                    value={editForm.role}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, role: event.target.value as PublicUser["role"] }))
                    }
                  >
                    <option value="member">Member</option>
                    <option value="owner">Owner</option>
                  </select>
                </label>
                <div className="user-editor-actions">
                  <button className="small-button" disabled={busy === `update-user-${user.id}`} type="submit">
                    {busy === `update-user-${user.id}` ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
                    Guardar
                  </button>
                  <button className="icon-button subtle" type="button" onClick={() => setEditingUserId(null)}>
                    <X size={16} />
                  </button>
                </div>
              </form>
            ) : (
              <>
                <span className="user-cell">
                  <i>{initials(user.name)}</i>
                  <span>
                    <strong>{user.email}</strong>
                    <small>{user.name}</small>
                  </span>
                </span>
                <span>{user.role}</span>
                <span>{user.lastLoginAt ? formatDate(user.lastLoginAt) : "-"}</span>
                <span>
                  <button
                    className="icon-button subtle"
                    disabled={!canManageUsers}
                    type="button"
                    title="Editar usuario"
                    onClick={() => startEdit(user)}
                  >
                    <Edit3 size={16} />
                  </button>
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function DomainsView({
  busy,
  domainForm,
  domains,
  setDomainForm,
  onAddDomain,
  onDeleteDomain,
  onForceVerify,
  onVerify
}: {
  busy: string | null;
  domainForm: { hostname: string };
  domains: Domain[];
  setDomainForm: (value: { hostname: string }) => void;
  onAddDomain: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteDomain: (id: string) => void;
  onForceVerify: (id: string) => void;
  onVerify: (id: string) => void;
}) {
  return (
    <section className="domains-view">
      <div className="domain-hero">
        <h2>Registra o conecta un dominio personalizado</h2>
        <p>Reemplaza el dominio predeterminado con tu propio dominio corto.</p>
        <div className="domain-demo">
          <span>link-app/abc</span>
          <strong>dayibiza.link/blog</strong>
        </div>
      </div>
      <div className="domain-panels">
        <form className="domain-connect-card" onSubmit={onAddDomain}>
          <Globe2 size={24} />
          <h3>Conecta un dominio que ya poseas</h3>
          <div className="domain-form">
            <input
              required
              placeholder="go.tumarca.com"
              value={domainForm.hostname}
              onChange={(event) => setDomainForm({ hostname: event.target.value })}
            />
            <button className="icon-button filled" disabled={busy === "create-domain"} title="Anadir dominio">
              {busy === "create-domain" ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
            </button>
          </div>
        </form>
        <div className="domain-list">
          {domains.length === 0 ? (
            <EmptyState text="Sin dominios todavia" />
          ) : (
            domains.map((domain) => (
              <DomainItem
                key={domain.id}
                domain={domain}
                busy={busy}
                onVerify={() => onVerify(domain.id)}
                onForceVerify={() => onForceVerify(domain.id)}
                onDelete={() => onDeleteDomain(domain.id)}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function PlaceholderView({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <section className="placeholder-view">
      {icon}
      <h2>{title}</h2>
      <p>Modulo reservado para la siguiente iteracion de V3.</p>
    </section>
  );
}

function SegmentedLabel({ title }: { title: string }) {
  return <h3 className="form-section-label">{title}</h3>;
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <article className="metric">
      <span>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function DomainItem({
  domain,
  busy,
  onVerify,
  onForceVerify,
  onDelete
}: {
  domain: Domain;
  busy: string | null;
  onVerify: () => void;
  onForceVerify: () => void;
  onDelete: () => void;
}) {
  const verified = domain.status === "verified";

  return (
    <article className="domain-item">
      <div className="domain-heading">
        <span className={`status-dot ${verified ? "verified" : ""}`} />
        <strong>{domain.hostname}</strong>
      </div>
      <div className="dns-row">
        <span>CNAME</span>
        <code>{domain.dnsTarget}</code>
      </div>
      <div className="item-actions">
        {verified ? (
          <span className="verified-label">
            <CheckCircle2 size={15} />
            Verificado
          </span>
        ) : (
          <>
            <button className="small-button" type="button" onClick={onVerify}>
              {busy === `verify-${domain.id}` ? <Loader2 className="spin" size={15} /> : <Check size={15} />}
              Verificar
            </button>
            <button className="small-button ghost" type="button" onClick={onForceVerify}>
              Dev
            </button>
          </>
        )}
        <button className="icon-button subtle" type="button" onClick={onDelete} title="Borrar dominio">
          {busy === `delete-domain-${domain.id}` ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
        </button>
      </div>
    </article>
  );
}

function LinkItem({
  link,
  domains,
  events,
  busy,
  onCopy,
  onDelete,
  onUpdate
}: {
  link: ShortLink;
  domains: Domain[];
  events: ClickEvent[];
  busy: string | null;
  onCopy: () => void;
  onDelete: () => void;
  onUpdate: (input: LinkUpdateInput) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [editForm, setEditForm] = useState(() => formFromLink(link));
  const shortUrl = buildShortUrl(link, domains);
  const destination = new URL(link.targetUrl);
  const topCountry = topValue(events.map((event) => event.country));
  const topDevice = topValue(events.map((event) => event.device));
  const expired = isExpired(link);

  useEffect(() => {
    setEditForm(formFromLink(link));
  }, [link]);

  useEffect(() => {
    let ignore = false;
    QRCode.toDataURL(shortUrl, { margin: 1, width: 220, color: { dark: "#1f2933", light: "#ffffff" } })
      .then((value) => {
        if (!ignore) {
          setQrDataUrl(value);
        }
      })
      .catch(() => setQrDataUrl(""));

    return () => {
      ignore = true;
    };
  }, [shortUrl]);

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onUpdate({
      title: editForm.title,
      slug: editForm.slug,
      targetUrl: editForm.targetUrl,
      isActive: editForm.isActive,
      tags: editForm.tags,
      campaign: editForm.campaign,
      expiresAt: editForm.expiresAt || null,
      clickLimit: editForm.clickLimit ? Number(editForm.clickLimit) : null,
      fallbackUrl: editForm.fallbackUrl
    });
    setEditing(false);
  }

  return (
    <article className={`link-item v2-card ${!link.isActive || expired ? "muted-card" : ""}`}>
      <div className="link-card-grid">
        <div className="link-content">
          <div className="link-main">
            <div>
              <div className="badge-row">
                <strong>{link.title}</strong>
                <StatusBadge link={link} />
              </div>
              <a href={shortUrl} target="_blank" rel="noreferrer">
                {shortUrl}
              </a>
            </div>
            <span className="click-pill">
              <MousePointerClick size={14} />
              {link.clicks}
            </span>
          </div>
          <div className="target-row">
            <span>{destination.hostname}</span>
            <p>{link.targetUrl}</p>
          </div>
          <div className="meta-row">
            {link.campaign ? (
              <span>
                <Activity size={13} />
                {link.campaign}
              </span>
            ) : null}
            {link.tags.map((tag) => (
              <span key={tag}>
                <Tags size={13} />
                {tag}
              </span>
            ))}
            {link.expiresAt ? (
              <span>
                <CalendarClock size={13} />
                {formatDate(link.expiresAt)}
              </span>
            ) : null}
          </div>
          <div className="analytics-strip">
            <AnalyticsMini label="Unicos" value={link.uniqueClicks || 0} />
            <AnalyticsMini label="Pais" value={topCountry || "-"} />
            <AnalyticsMini label="Dispositivo" value={topDevice || "-"} />
            <AnalyticsMini label="Ultimo" value={link.lastClickedAt ? formatDate(link.lastClickedAt) : "-"} />
          </div>
          {editing ? (
            <form className="edit-form" onSubmit={saveEdit}>
              <div className="form-row">
                <label>
                  Titulo
                  <input
                    value={editForm.title}
                    onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))}
                  />
                </label>
                <label>
                  Slug / URL corta
                  <input
                    required
                    value={editForm.slug}
                    onChange={(event) => setEditForm((current) => ({ ...current, slug: event.target.value }))}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Activo
                  <select
                    value={editForm.isActive ? "true" : "false"}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, isActive: event.target.value === "true" }))
                    }
                  >
                    <option value="true">Activo</option>
                    <option value="false">Pausado</option>
                  </select>
                </label>
                <label>
                  URL destino
                  <input
                    required
                    type="url"
                    placeholder="https://ejemplo.com/nueva-url"
                    value={editForm.targetUrl}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, targetUrl: event.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Campana
                  <input
                    value={editForm.campaign}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, campaign: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Tags
                  <input
                    value={editForm.tags}
                    onChange={(event) => setEditForm((current) => ({ ...current, tags: event.target.value }))}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Expira
                  <input
                    type="datetime-local"
                    value={editForm.expiresAt}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, expiresAt: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Limite clics
                  <input
                    min="1"
                    type="number"
                    value={editForm.clickLimit}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, clickLimit: event.target.value }))
                    }
                  />
                </label>
              </div>
              <label>
                URL fallback
                <input
                  value={editForm.fallbackUrl}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, fallbackUrl: event.target.value }))
                  }
                />
              </label>
              <div className="item-actions">
                <button className="small-button ghost" type="button" onClick={() => setEditing(false)}>
                  <X size={15} />
                  Cerrar
                </button>
                <button className="small-button" type="submit">
                  {busy === `save-link-${link.id}` ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
                  Guardar
                </button>
              </div>
            </form>
          ) : null}
          <div className="item-actions">
            <button className="small-button" type="button" onClick={onCopy}>
              <Clipboard size={15} />
              Copiar
            </button>
            <button className="small-button ghost" type="button" onClick={() => setEditing((value) => !value)}>
              <Edit3 size={15} />
              Editar
            </button>
            <button
              className="small-button ghost"
              type="button"
              onClick={() => onUpdate({ isActive: !link.isActive })}
            >
              <Power size={15} />
              {link.isActive ? "Pausar" : "Activar"}
            </button>
            <button className="icon-button subtle" type="button" onClick={onDelete} title="Borrar link">
              {busy === `delete-link-${link.id}` ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
            </button>
          </div>
        </div>
        <div className="qr-panel">
          {qrDataUrl ? <img src={qrDataUrl} alt={`QR ${link.slug}`} /> : <QrCode size={72} />}
          <a className="download-button" href={qrDataUrl} download={`${link.slug}-qr.png`}>
            <Download size={15} />
            QR
          </a>
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ link }: { link: ShortLink }) {
  if (!link.isActive) {
    return <span className="status-badge paused">Pausado</span>;
  }

  if (isExpired(link)) {
    return <span className="status-badge expired">Expirado</span>;
  }

  return <span className="status-badge active">Activo</span>;
}

function AnalyticsMini({ label, value }: { label: string; value: string | number }) {
  return (
    <span>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <Link2 size={18} />
      <span>{text}</span>
    </div>
  );
}

function buildShortUrl(link: ShortLink, domains: Domain[]) {
  const domain = domains.find((item) => item.id === link.domainId);

  if (domain) {
    return `https://${domain.hostname}/${link.slug}`;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}/${link.slug}`;
  }

  return `${DEFAULT_BASE_URL}/${link.slug}`;
}

function withUtmParams(form: typeof emptyLinkForm) {
  const url = new URL(form.targetUrl);
  const values = {
    utm_source: form.utmSource,
    utm_medium: form.utmMedium,
    utm_campaign: form.utmCampaign,
    utm_content: form.utmContent,
    utm_term: form.utmTerm
  };

  for (const [key, value] of Object.entries(values)) {
    if (value.trim()) {
      url.searchParams.set(key, value.trim());
    }
  }

  return url.toString();
}

function formFromLink(link: ShortLink) {
  return {
    title: link.title,
    slug: link.slug,
    targetUrl: link.targetUrl,
    isActive: link.isActive,
    tags: link.tags.join(", "),
    campaign: link.campaign,
    expiresAt: toDateTimeLocal(link.expiresAt),
    clickLimit: link.clickLimit ? String(link.clickLimit) : "",
    fallbackUrl: link.fallbackUrl
  };
}

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function safeHostname(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function topValue(values: string[]) {
  const counts = values.reduce<Record<string, number>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] || 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function filterAnalyticsEvents(events: ClickEvent[], range: string, selectedLinkId: string) {
  const rangeStart =
    range === "all"
      ? null
      : new Date(Date.now() - (Number(range) - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return events.filter((event) => {
    const matchesLink = selectedLinkId === "all" || event.linkId === selectedLinkId;
    const matchesRange = !rangeStart || event.createdAt.slice(0, 10) >= rangeStart;
    return matchesLink && matchesRange;
  });
}

function groupAnalytics(events: ClickEvent[], getLabel: (event: ClickEvent) => string): AnalyticsRow[] {
  const total = events.length;
  const counts = events.reduce<Record<string, number>>((accumulator, event) => {
    const label = getLabel(event).trim() || "Desconocido";
    accumulator[label] = (accumulator[label] || 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts)
    .map(([label, count]) => ({
      label,
      count,
      percent: total ? Math.round((count / total) * 1000) / 10 : 0
    }))
    .toSorted((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function readableReferrer(referrer: string) {
  if (!referrer || referrer === "Directo") {
    return "Directo";
  }

  return referrer
    .replace(/^www\./, "")
    .replace("linkedin.com", "LinkedIn")
    .replace("facebook.com", "Facebook")
    .replace("google.com", "Google")
    .replace("t.co", "Twitter/X")
    .replace("x.com", "Twitter/X");
}

function countryName(country: string) {
  const labels: Record<string, string> = {
    AU: "Australia",
    CA: "Canada",
    DE: "Germany",
    ES: "Spain",
    FR: "France",
    GB: "United Kingdom",
    IN: "India",
    IT: "Italy",
    JP: "Japan",
    MX: "Mexico",
    PT: "Portugal",
    US: "United States"
  };

  return labels[country] || country || "Desconocido";
}

function deviceName(device: ClickEvent["device"]) {
  return {
    bot: "Robot",
    desktop: "Escritorio",
    mobile: "Dispositivo movil",
    tablet: "Tableta",
    unknown: "Desconocido"
  }[device];
}

function donutGradient(rows: AnalyticsRow[], total: number) {
  let cursor = 0;
  const segments = rows.map((row, index) => {
    const size = total ? (row.count / total) * 100 : 0;
    const start = cursor;
    cursor += size;
    return `${ANALYTICS_COLORS[index % ANALYTICS_COLORS.length]} ${start}% ${cursor}%`;
  });

  return `conic-gradient(${segments.join(", ")})`;
}

function downloadAnalyticsCsv(events: ClickEvent[], links: ShortLink[]) {
  const rows = [
    ["created_at", "slug", "title", "country", "device", "browser", "referrer"],
    ...events.map((event) => {
      const link = links.find((item) => item.id === event.linkId);
      return [
        event.createdAt,
        event.slug,
        link?.title || "",
        countryName(event.country),
        deviceName(event.device),
        event.browser,
        readableReferrer(event.referrer)
      ];
    })
  ];
  const csv = rows.map((row) => row.map(csvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `link-up-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvValue(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function isExpired(link: ShortLink) {
  const dateExpired = link.expiresAt ? new Date(link.expiresAt).getTime() <= Date.now() : false;
  const clickExpired = link.clickLimit ? link.clicks >= link.clickLimit : false;
  return dateExpired || clickExpired;
}

function viewTitle(view: View) {
  return {
    overview: "Inicio",
    create: "Crear nuevo enlace",
    links: "Todos los enlaces de seguimiento",
    analytics: "Analytics",
    apiKeys: "API Keys",
    users: "Usuarios",
    domains: "Dominios",
    imports: "Importacion masiva",
    settings: "Configuracion"
  }[view];
}

function viewSubtitle(view: View) {
  return {
    overview: "Resumen general del workspace.",
    create: "Configura destino, UTMs, expiracion y QR.",
    links: "Gestiona tus enlaces, clics y URLs cortas.",
    analytics: "Origen, ubicacion y rendimiento de tus enlaces.",
    apiKeys: "Genera claves para crear enlaces desde proyectos externos.",
    users: "Gestiona las personas del workspace.",
    domains: "Conecta dominios personalizados.",
    imports: "Carga enlaces en lote.",
    settings: "Ajustes del workspace y cuenta."
  }[view];
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function camelToUtm(value: string) {
  return value.replace("utm", "utm_").replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

function clicksToday(events: ClickEvent[], linkId: string) {
  const today = new Date().toISOString().slice(0, 10);
  return events.filter((event) => event.linkId === linkId && event.createdAt.startsWith(today)).length;
}

function lastNDays(events: ClickEvent[], days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      label: key.slice(5),
      count: events.filter((event) => event.createdAt.startsWith(key)).length
    };
  });
}
