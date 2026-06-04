export type DomainStatus = "pending" | "verified";

export type Domain = {
  id: string;
  hostname: string;
  status: DomainStatus;
  dnsTarget: string;
  createdAt: string;
  verifiedAt: string | null;
};

export type ShortLink = {
  id: string;
  title: string;
  slug: string;
  targetUrl: string;
  domainId: string | null;
  clicks: number;
  uniqueClicks: number;
  isActive: boolean;
  tags: string[];
  campaign: string;
  expiresAt: string | null;
  clickLimit: number | null;
  fallbackUrl: string;
  createdAt: string;
  updatedAt: string;
  lastClickedAt: string | null;
};

export type ClickEvent = {
  id: string;
  linkId: string;
  slug: string;
  domainId: string | null;
  createdAt: string;
  country: string;
  device: "desktop" | "mobile" | "tablet" | "bot" | "unknown";
  browser: string;
  referrer: string;
  ipHash: string;
};

export type Store = {
  domains: Domain[];
  links: ShortLink[];
  clickEvents: ClickEvent[];
};
