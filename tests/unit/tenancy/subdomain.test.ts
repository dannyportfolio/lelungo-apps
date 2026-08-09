import { describe, expect, it } from 'vitest';

import {
  normalizeTenantSubdomain,
  resolveTenantSubdomainFromHost,
} from '@/modules/tenancy/subdomain';

describe('tenant subdomain handling', () => {
  const productionOptions = {
    rootDomain: 'lelungo.com',
    localRootDomain: 'localhost',
    allowLocalTenantHosts: false,
  };

  it('normalizes a valid requested subdomain', () => {
    expect(normalizeTenantSubdomain('  Homestay-Melati ')).toBe('homestay-melati');
  });

  it('rejects reserved and malformed subdomains', () => {
    expect(() => normalizeTenantSubdomain('admin')).toThrow('reserved');
    expect(() => normalizeTenantSubdomain('-melati')).toThrow('Subdomain');
  });

  it('accepts exactly one wildcard label under the configured root domain', () => {
    expect(resolveTenantSubdomainFromHost('melati.lelungo.com', productionOptions)).toBe('melati');
    expect(resolveTenantSubdomainFromHost('lelungo.com', productionOptions)).toBeNull();
    expect(resolveTenantSubdomainFromHost('www.lelungo.com', productionOptions)).toBeNull();
    expect(resolveTenantSubdomainFromHost('a.b.lelungo.com', productionOptions)).toBeNull();
  });

  it('allows local wildcard routing only when explicitly enabled', () => {
    expect(resolveTenantSubdomainFromHost('melati.localhost', productionOptions)).toBeNull();
    expect(
      resolveTenantSubdomainFromHost('melati.localhost', {
        ...productionOptions,
        allowLocalTenantHosts: true,
      }),
    ).toBe('melati');
  });
});
