import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ useActionState: vi.fn(), action: vi.fn() }));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useActionState: mocks.useActionState,
}));
vi.mock('react-dom', () => ({ useFormStatus: () => ({ pending: false }) }));

import { PropertyForm } from '@/app/staff/properties/property-form';

describe('PropertyForm', () => {
  beforeEach(() => {
    mocks.useActionState.mockReturnValue([{ status: 'idle' }, '/staff/properties/new', false]);
  });

  it('uses accessible labels, bounded browser hints, and no ownership/lifecycle fields', () => {
    const markup = renderToStaticMarkup(createElement(PropertyForm, { action: mocks.action }));

    expect(markup).toContain('name="name"');
    expect(markup).toContain('maxLength="120"');
    expect(markup).toContain('name="slug"');
    expect(markup).toContain('maxLength="80"');
    expect(markup).toContain('name="timezone"');
    expect(markup).toContain('value="Asia/Jakarta"');
    expect(markup).toMatch(/<input[^>]*readOnly=""[^>]*name="countryCode"[^>]*value="ID"/);
    expect(markup).not.toContain('name="tenantId"');
    expect(markup).not.toContain('name="lifecycle"');
    expect(markup).not.toContain('name="version"');
  });

  it('renders safe validation feedback as an alert', () => {
    mocks.useActionState.mockReturnValue([
      {
        status: 'error',
        message: 'Periksa kembali data Property.',
        fieldErrors: { timezone: ['Invalid canonical IANA timezone.'] },
      },
      '/staff/properties/new',
      false,
    ]);
    const markup = renderToStaticMarkup(createElement(PropertyForm, { action: mocks.action }));

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('timezone: Invalid canonical IANA timezone.');
  });
});
