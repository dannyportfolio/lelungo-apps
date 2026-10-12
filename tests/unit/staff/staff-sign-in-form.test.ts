import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signInStaffAction: vi.fn(),
  useActionState: vi.fn(),
}));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useActionState: mocks.useActionState,
}));

vi.mock('@/app/staff/sign-in/actions', () => ({
  signInStaffAction: mocks.signInStaffAction,
}));

import { StaffSignInForm } from '@/app/staff/sign-in/sign-in-form';

describe('StaffSignInForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActionState({ status: 'idle' });
  });

  it('associates accessible labels and browser hints with each credential field', () => {
    const markup = renderForm();
    const emailInput = getStartTag(markup, 'input', 'id="email"');
    const passwordInput = getStartTag(markup, 'input', 'id="password"');

    expect(markup).toMatch(/<label[^>]*for="email"[^>]*>Email staf<\/label>/);
    expect(emailInput).toContain('name="email"');
    expect(emailInput).toContain('type="email"');
    expect(emailInput).toContain('autoComplete="email"');
    expect(emailInput).toContain('required=""');
    expect(markup).toMatch(/<label[^>]*for="password"[^>]*>Kata sandi<\/label>/);
    expect(passwordInput).toContain('name="password"');
    expect(passwordInput).toContain('type="password"');
    expect(passwordInput).toContain('autoComplete="current-password"');
    expect(passwordInput).toContain('required=""');
    expect(markup).toContain('type="hidden" name="next" value="/staff/profile"');
    expect(markup).toContain('Masuk ke PMS');
    expect(markup).not.toContain('role="alert"');
  });

  it('exposes validation feedback through an alert and field descriptions', () => {
    setActionState({
      status: 'error',
      message: 'Periksa kembali data masuk Anda.',
      fieldErrors: {
        email: ['Masukkan alamat email yang valid.'],
        password: ['Masukkan kata sandi.'],
      },
    });

    const markup = renderForm();

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Periksa kembali data masuk Anda.');
    expect(markup).toMatch(
      /<input[^>]*id="email"[^>]*aria-invalid="true"[^>]*aria-describedby="email-error"/,
    );
    expect(markup).toContain('id="email-error"');
    expect(markup).toContain('Masukkan alamat email yang valid.');
    expect(markup).toMatch(
      /<input[^>]*id="password"[^>]*aria-invalid="true"[^>]*aria-describedby="password-error"/,
    );
    expect(markup).toContain('id="password-error"');
    expect(markup).toContain('Masukkan kata sandi.');
  });

  it('disables submission and announces visible pending feedback', () => {
    setActionState({ status: 'idle' }, true);

    const markup = renderForm();

    expect(markup).toMatch(/<button[^>]*type="submit"[^>]*disabled=""[^>]*>/);
    expect(markup).toContain('Memverifikasi...');
    expect(markup).not.toContain('Masuk ke PMS');
  });
});

function setActionState(
  state: {
    status: 'idle' | 'error';
    message?: string;
    fieldErrors?: { email?: string[]; password?: string[] };
  },
  pending = false,
): void {
  // A string form action keeps the server-rendered accessibility snapshot focused
  // on the component output; the Server Action itself has separate unit coverage.
  mocks.useActionState.mockReturnValue([state, '/staff/sign-in', pending]);
}

function renderForm(): string {
  return renderToStaticMarkup(createElement(StaffSignInForm, { redirectTo: '/staff/profile' }));
}

function getStartTag(markup: string, element: string, identifyingAttribute: string): string {
  const startTag = markup.match(new RegExp(`<${element}[^>]*${identifyingAttribute}[^>]*>`))?.[0];
  expect(startTag).toBeDefined();
  return startTag ?? '';
}
