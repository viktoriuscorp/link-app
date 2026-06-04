"use client";

import {
  Activity,
  Check,
  CheckCircle2,
  Clipboard,
  Globe2,
  Link2,
  Loader2,
  MousePointerClick,
  Plus,
  RefreshCw,
  Send,
  Trash2
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { Domain, ShortLink, Store } from "@/lib/types";
import { DEFAULT_BASE_URL } from "@/lib/config";

type Snapshot = Pick<Store, "domains" | "links">;
type Toast = { tone: "success" | "error"; text: string } | null;

export function Dashboard({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [domains, setDomains] = useState(initialSnapshot.domains);
  const [links, setLinks] = useState(initialSnapshot.links);
  const [toast, setToast] = useState<Toast>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [linkForm, setLinkForm] = useState({
    title: "",
    targetUrl: "",
    slug: "",
    domainId: "base"
  });
  const [domainForm, setDomainForm] = useState({ hostname: "" });

  const stats = useMemo(
    () => ({
      links: links.length,
      clicks: links.reduce((total, link) => total + link.clicks, 0),
      verifiedDomains: domains.filter((domain) => domain.status === "verified").length
    }),
    [domains, links]
  );

  async function refresh() {
    const response = await fetch("/api/snapshot", { cache: "no-store" });
    const snapshot = (await response.json()) as Snapshot;
    setDomains(snapshot.domains);
    setLinks(snapshot.links);
  }

  async function createLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create-link");
    setToast(null);

    try {
      const response = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(linkForm)
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message);
      }

      setLinks((current) => [payload, ...current]);
      setLinkForm((current) => ({ ...current, title: "", targetUrl: "", slug: "" }));
      setToast({ tone: "success", text: "Link creado." });
    } catch (error) {
      setToast({ tone: "error", text: error instanceof Error ? error.message : "No se pudo crear." });
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
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Link2 size={21} strokeWidth={2.4} />
          </span>
          <div>
            <h1>Link App</h1>
            <p>Links cortos con dominio propio</p>
          </div>
        </div>
        <div className="header-actions">
          {toast ? <span className={`toast ${toast.tone}`}>{toast.text}</span> : null}
          <button className="icon-button" type="button" onClick={refresh} title="Actualizar">
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <section className="stats-grid" aria-label="Resumen">
        <Metric icon={<Link2 size={18} />} label="Links" value={stats.links} />
        <Metric icon={<MousePointerClick size={18} />} label="Clics" value={stats.clicks} />
        <Metric icon={<Globe2 size={18} />} label="Dominios" value={stats.verifiedDomains} />
      </section>

      <div className="workspace">
        <section className="panel create-panel">
          <div className="panel-title">
            <h2>Nuevo link</h2>
            <Send size={18} />
          </div>
          <form className="form-stack" onSubmit={createLink}>
            <label>
              URL destino
              <input
                required
                placeholder="https://ejemplo.com/pagina-larga"
                value={linkForm.targetUrl}
                onChange={(event) =>
                  setLinkForm((current) => ({ ...current, targetUrl: event.target.value }))
                }
              />
            </label>
            <div className="form-row">
              <label>
                Titulo
                <input
                  placeholder="Campana junio"
                  value={linkForm.title}
                  onChange={(event) =>
                    setLinkForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </label>
              <label>
                Slug
                <input
                  placeholder="verano"
                  value={linkForm.slug}
                  onChange={(event) =>
                    setLinkForm((current) => ({ ...current, slug: event.target.value }))
                  }
                />
              </label>
            </div>
            <label>
              Dominio
              <select
                value={linkForm.domainId}
                onChange={(event) =>
                  setLinkForm((current) => ({ ...current, domainId: event.target.value }))
                }
              >
                <option value="base">Dominio base</option>
                {domains
                  .filter((domain) => domain.status === "verified")
                  .map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.hostname}
                    </option>
                  ))}
              </select>
            </label>
            <button className="primary-button" disabled={busy === "create-link"}>
              {busy === "create-link" ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
              Crear link
            </button>
          </form>
        </section>

        <section className="panel domains-panel">
          <div className="panel-title">
            <h2>Dominios</h2>
            <Globe2 size={18} />
          </div>
          <form className="domain-form" onSubmit={addDomain}>
            <input
              required
              placeholder="go.tumarca.com"
              value={domainForm.hostname}
              onChange={(event) => setDomainForm({ hostname: event.target.value })}
            />
            <button className="icon-button filled" disabled={busy === "create-domain"} title="Anadir dominio">
              {busy === "create-domain" ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
            </button>
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
                  onVerify={() => verifyDomain(domain.id)}
                  onForceVerify={() => verifyDomain(domain.id, true)}
                  onDelete={() => deleteDomain(domain.id)}
                />
              ))
            )}
          </div>
        </section>

        <section className="panel links-panel">
          <div className="panel-title">
            <h2>Links</h2>
            <Activity size={18} />
          </div>
          <div className="link-list">
            {links.length === 0 ? (
              <EmptyState text="Crea el primer link" />
            ) : (
              links.map((link) => (
                <LinkItem
                  key={link.id}
                  link={link}
                  domains={domains}
                  busy={busy}
                  onCopy={() => copyShortUrl(link)}
                  onDelete={() => deleteLink(link.id)}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
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
          {busy === `delete-domain-${domain.id}` ? (
            <Loader2 className="spin" size={16} />
          ) : (
            <Trash2 size={16} />
          )}
        </button>
      </div>
    </article>
  );
}

function LinkItem({
  link,
  domains,
  busy,
  onCopy,
  onDelete
}: {
  link: ShortLink;
  domains: Domain[];
  busy: string | null;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const shortUrl = buildShortUrl(link, domains);
  const destination = new URL(link.targetUrl);

  return (
    <article className="link-item">
      <div className="link-main">
        <div>
          <strong>{link.title}</strong>
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
      <div className="item-actions">
        <button className="small-button" type="button" onClick={onCopy}>
          <Clipboard size={15} />
          Copiar
        </button>
        <button className="icon-button subtle" type="button" onClick={onDelete} title="Borrar link">
          {busy === `delete-link-${link.id}` ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
        </button>
      </div>
    </article>
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
