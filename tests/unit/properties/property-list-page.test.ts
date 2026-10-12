import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getRequestTenantContext: vi.fn(),
  requireAuthenticatedTenantMembership: vi.fn(),
  requireAuthorizedPropertyListScope: vi.fn(),
  listProperties: vi.fn(),
}));

vi.mock('@/modules/tenancy/tenant-context', () => ({
  getRequestTenantContext: mocks.getRequestTenantContext,
}));
vi.mock('@/modules/tenancy/tenant-access', () => ({
  requireAuthenticatedTenantMembership: mocks.requireAuthenticatedTenantMembership,
}));
vi.mock('@/modules/identity/property-authorization', () => ({
  requireAuthorizedPropertyListScope: mocks.requireAuthorizedPropertyListScope,
}));
vi.mock('@/modules/properties/property-service', () => ({
  listProperties: mocks.listProperties,
}));

import PropertiesPage from '@/app/staff/properties/page';

describe('PropertiesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const context = {
      tenant: { id: 'tenant-a' },
      membership: {
        permissions: ['property.read'],
        propertyAccessMode: 'SELECTED_PROPERTIES',
      },
    };
    mocks.getRequestTenantContext.mockResolvedValue(context);
    mocks.requireAuthenticatedTenantMembership.mockReturnValue(context);
    mocks.requireAuthorizedPropertyListScope.mockReturnValue({ kind: 'selected' });
  });

  it('renders an accessible empty state without exposing a create control to selected scope', async () => {
    mocks.listProperties.mockResolvedValue({ items: [], nextCursor: null });

    const element = await PropertiesPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(createElement(() => element));

    expect(markup).toContain('<h1');
    expect(markup).toContain('Properties</h1>');
    expect(markup).toContain('<h2');
    expect(markup).toContain('Belum ada Property yang dapat diakses</h2>');
    expect(markup).not.toContain('Tambah Property');
    expect(mocks.listProperties).toHaveBeenCalledWith({ kind: 'selected' }, { pageSize: 25 });
  });

  it('renders a bounded continuation link and usability-only create control for broad managers', async () => {
    const context = {
      tenant: { id: 'tenant-a' },
      membership: {
        permissions: ['property.read', 'property.manage'],
        propertyAccessMode: 'ALL_PROPERTIES',
      },
    };
    mocks.requireAuthenticatedTenantMembership.mockReturnValue(context);
    mocks.requireAuthorizedPropertyListScope.mockReturnValue({ kind: 'ALL_PROPERTIES' });
    mocks.listProperties.mockResolvedValue({
      items: [
        {
          id: 'property-a',
          name: 'Villa A',
          slug: 'villa-a',
          locality: 'Sleman',
          adminArea: 'DI Yogyakarta',
          lifecycle: 'DRAFT',
        },
      ],
      nextCursor: 'v1+/=',
    });

    const element = await PropertiesPage({
      searchParams: Promise.resolve({ cursor: 'current-cursor' }),
    });
    const markup = renderToStaticMarkup(createElement(() => element));

    expect(markup).toContain('Villa A');
    expect(markup).toContain('href="/staff/properties/new"');
    expect(markup).toContain('href="/staff/properties?cursor=v1%2B%2F%3D"');
    expect(markup).toContain('Halaman berikutnya');
    expect(mocks.listProperties).toHaveBeenCalledWith(
      { kind: 'ALL_PROPERTIES' },
      { pageSize: 25, cursor: 'current-cursor' },
    );
  });
});
