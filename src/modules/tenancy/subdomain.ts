import { z } from 'zod';

const RESERVED_SUBDOMAINS = new Set([
  'admin',
  'api',
  'app',
  'www',
  'auth',
  'billing',
  'support',
  'status',
  'static',
  'assets',
  'mail',
  'dashboard',
  'checkin',
  'developer',
  'docs',
]);

const subdomainSchema = z
  .string()
  .trim()
  .min(1)
  .max(63)
  .transform((value) => value.toLowerCase())
  .refine((value) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value), {
    message: 'Subdomain may contain only lowercase letters, numbers, and internal hyphens.',
  })
  .refine((value) => !RESERVED_SUBDOMAINS.has(value), {
    message: 'This subdomain is reserved.',
  });

export interface TenantHostResolutionOptions {
  rootDomain: string;
  localRootDomain: string;
  allowLocalTenantHosts: boolean;
}

export function normalizeTenantSubdomain(input: string): string {
  return subdomainSchema.parse(input);
}

export function resolveTenantSubdomainFromHost(
  host: string,
  options: TenantHostResolutionOptions,
): string | null {
  const normalizedHost = normalizeHost(host);
  const rootDomain = normalizeHost(options.rootDomain);

  const productionSubdomain = extractSingleSubdomain(normalizedHost, rootDomain);
  if (productionSubdomain) {
    return safeNormalizeSubdomain(productionSubdomain);
  }

  if (!options.allowLocalTenantHosts) {
    return null;
  }

  const localRootDomain = normalizeHost(options.localRootDomain);
  const localSubdomain = extractSingleSubdomain(normalizedHost, localRootDomain);
  return localSubdomain ? safeNormalizeSubdomain(localSubdomain) : null;
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, '').replace(/:\d+$/, '');
}

function extractSingleSubdomain(host: string, rootDomain: string): string | null {
  if (!host || !rootDomain || host === rootDomain || host === `www.${rootDomain}`) {
    return null;
  }

  const suffix = `.${rootDomain}`;
  if (!host.endsWith(suffix)) {
    return null;
  }

  const candidate = host.slice(0, -suffix.length);
  return candidate.includes('.') ? null : candidate;
}

function safeNormalizeSubdomain(value: string): string | null {
  const result = subdomainSchema.safeParse(value);
  return result.success ? result.data : null;
}
