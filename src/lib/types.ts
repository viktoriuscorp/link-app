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
  createdAt: string;
  updatedAt: string;
  lastClickedAt: string | null;
};

export type Store = {
  domains: Domain[];
  links: ShortLink[];
};
