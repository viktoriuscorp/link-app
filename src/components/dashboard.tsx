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
  Filter,
  Globe2,
  Link2,
  Loader2,
  MousePointerClick,
  Plus,
  Power,
  QrCode,
  RefreshCw,
  Save,
  Send,
  Tags,
  Trash2,
  X
} from "lucide-react";
import QRCode from "qrcode";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ClickEvent, Domain, ShortLink, Store } from "@/lib/types";
import { DEFAULT_BASE_URL } from "@/lib/config";

type Snapshot = Pick<Store, "domains" | "links" | "clickEvents">;
type Toast = { tone: "success" | "error"; text: string } | null;
type LinkUpdateInput = Partial<Omit<ShortLink, "tags">> & { tags?: string };

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

export function Dashboard({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [domains, setDomains] = useState(initialSnapshot.domains);
  const [links, setLinks] = useState(initialSnapshot.links);
  const [clickEvents, setClickEvents] = useState(initialSnapshot.clickEvents);
  const [toast, setToast] = useState<Toast>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [linkForm, setLinkForm] = useState(emptyLinkForm);
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
    const response = await fetch("/api/snapshot", { cache: "no-store" });
    const snapshot = (await response.json()) as Snapshot;
    setDomains(snapshot.domains);
    setLinks(snapshot.links);
    setClickEvents(snapshot.clickEvents);
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
      setToast({ tone: "success", text: "Link V2 creado." });
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
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Link2 size={21} strokeWidth={2.4} />
          </span>
          <div>
            <h1>Link App</h1>
            <p>Version 2 local</p>
          </div>
        </div>
        <div className="header-actions">
          {toast ? <span className={`toast ${toast.tone}`}>{toast.text}</span> : null}
          <button className="icon-button" type="button" onClick={refresh} title="Actualizar">
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <section className="stats-grid v2" aria-label="Resumen">
        <Metric icon={<Link2 size={18} />} label="Links" value={stats.links} />
        <Metric icon={<Power size={18} />} label="Activos" value={stats.activeLinks} />
        <Metric icon={<MousePointerClick size={18} />} label="Clics" value={stats.clicks} />
        <Metric icon={<BarChart3 size={18} />} label="Unicos" value={stats.uniqueClicks} />
      </section>

      <div className="workspace v2-workspace">
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
            <div className="form-row">
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
              <label>
                Campana
                <input
                  placeholder="launch"
                  value={linkForm.campaign}
                  onChange={(event) =>
                    setLinkForm((current) => ({ ...current, campaign: event.target.value }))
                  }
                />
              </label>
            </div>
            <label>
              Tags
              <input
                placeholder="ads, newsletter, producto"
                value={linkForm.tags}
                onChange={(event) => setLinkForm((current) => ({ ...current, tags: event.target.value }))}
              />
            </label>
            <div className="compact-grid">
              <input
                placeholder="utm_source"
                value={linkForm.utmSource}
                onChange={(event) => setLinkForm((current) => ({ ...current, utmSource: event.target.value }))}
              />
              <input
                placeholder="utm_medium"
                value={linkForm.utmMedium}
                onChange={(event) => setLinkForm((current) => ({ ...current, utmMedium: event.target.value }))}
              />
              <input
                placeholder="utm_campaign"
                value={linkForm.utmCampaign}
                onChange={(event) =>
                  setLinkForm((current) => ({ ...current, utmCampaign: event.target.value }))
                }
              />
              <input
                placeholder="utm_content"
                value={linkForm.utmContent}
                onChange={(event) =>
                  setLinkForm((current) => ({ ...current, utmContent: event.target.value }))
                }
              />
              <input
                placeholder="utm_term"
                value={linkForm.utmTerm}
                onChange={(event) => setLinkForm((current) => ({ ...current, utmTerm: event.target.value }))}
              />
            </div>
            <div className="form-row">
              <label>
                Expira
                <input
                  type="datetime-local"
                  value={linkForm.expiresAt}
                  onChange={(event) =>
                    setLinkForm((current) => ({ ...current, expiresAt: event.target.value }))
                  }
                />
              </label>
              <label>
                Limite clics
                <input
                  min="1"
                  type="number"
                  placeholder="500"
                  value={linkForm.clickLimit}
                  onChange={(event) =>
                    setLinkForm((current) => ({ ...current, clickLimit: event.target.value }))
                  }
                />
              </label>
            </div>
            <label>
              URL fallback
              <input
                placeholder="https://ejemplo.com/cerrado"
                value={linkForm.fallbackUrl}
                onChange={(event) =>
                  setLinkForm((current) => ({ ...current, fallbackUrl: event.target.value }))
                }
              />
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
          <div className="panel-title toolbar-title">
            <div>
              <h2>Links</h2>
              <p>{filteredLinks.length} visibles</p>
            </div>
            <label className="search-field">
              <Filter size={16} />
              <input
                placeholder="Buscar"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
          <div className="link-list">
            {filteredLinks.length === 0 ? (
              <EmptyState text="Sin resultados" />
            ) : (
              filteredLinks.map((link) => (
                <LinkItem
                  key={link.id}
                  link={link}
                  domains={domains}
                  events={clickEvents.filter((event) => event.linkId === link.id)}
                  busy={busy}
                  onCopy={() => copyShortUrl(link)}
                  onDelete={() => deleteLink(link.id)}
                  onUpdate={(input) => updateLink(link.id, input)}
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
              </div>
              <label>
                URL destino
                <input
                  required
                  value={editForm.targetUrl}
                  onChange={(event) => setEditForm((current) => ({ ...current, targetUrl: event.target.value }))}
                />
              </label>
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

function topValue(values: string[]) {
  const counts = values.reduce<Record<string, number>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] || 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function isExpired(link: ShortLink) {
  const dateExpired = link.expiresAt ? new Date(link.expiresAt).getTime() <= Date.now() : false;
  const clickExpired = link.clickLimit ? link.clicks >= link.clickLimit : false;
  return dateExpired || clickExpired;
}
