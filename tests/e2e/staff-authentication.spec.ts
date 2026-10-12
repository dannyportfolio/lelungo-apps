import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  startFakeSupabaseAuthServer,
  type FakeSupabaseAuthServer,
} from './support/fake-supabase-auth-server';
import {
  createTenantWithoutMembershipFixture,
  type TenantWithoutMembershipFixture,
} from './support/tenant-without-membership-fixture';
import {
  createPropertyFoundationFixture,
  type PropertyFoundationFixture,
} from './support/property-foundation-fixture';

const authenticationProviderURL = 'http://127.0.0.1:54329';
const applicationURL = process.env.BASE_URL || 'http://localhost:3000';
const deterministicPropertyTests = process.env.E2E_PROPERTY_SCENARIO;
const authenticatedUserId = '7d6126df-5cbc-4cf8-8c2e-d0ba0cb95715';
const accessToken = createTestAccessToken();
let fakeAuthenticationProvider: FakeSupabaseAuthServer | undefined;
let tenantWithoutMembership: TenantWithoutMembershipFixture | undefined;
let propertyFoundation: PropertyFoundationFixture | undefined;

test.describe('staff authentication boundary', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    if (!process.env.E2E_SUPABASE_URL) {
      fakeAuthenticationProvider = await startFakeSupabaseAuthServer();
      try {
        if (!deterministicPropertyTests || deterministicPropertyTests === 'NO_MEMBERSHIP') {
          tenantWithoutMembership = await createTenantWithoutMembershipFixture(applicationURL);
        }
        if (!deterministicPropertyTests || deterministicPropertyTests === 'PROPERTY') {
          propertyFoundation = await createPropertyFoundationFixture(
            applicationURL,
            authenticatedUserId,
          );
        }
      } catch (error) {
        await fakeAuthenticationProvider.close();
        fakeAuthenticationProvider = undefined;
        throw error;
      }
    }
  });

  test.afterAll(async () => {
    try {
      await tenantWithoutMembership?.close();
    } finally {
      try {
        await propertyFoundation?.close();
      } finally {
        await fakeAuthenticationProvider?.close();
      }
    }
  });

  test('redirects an unauthenticated request to the staff sign-in page', async ({ page }) => {
    test.skip(Boolean(deterministicPropertyTests), 'Covered by the complete staff suite.');
    await page.goto('/staff');

    const destination = new URL(page.url());
    expect(destination.pathname).toBe('/staff/sign-in');
    expect(destination.searchParams.get('next')).toBe('/staff');
    await expect(page.getByRole('heading', { name: 'Masuk sebagai staf' })).toBeVisible();
  });

  test('shows a generic denial for a verified user without tenant membership', async ({
    context,
    page,
  }) => {
    test.skip(
      Boolean(process.env.E2E_SUPABASE_URL) || deterministicPropertyTests === 'PROPERTY',
      'The deterministic session fixture applies only to the built-in local auth provider.',
    );

    if (!tenantWithoutMembership) {
      throw new Error('The deterministic tenant-without-membership fixture was not created.');
    }

    await context.addCookies([
      {
        name: authenticationCookieName(authenticationProviderURL),
        value: encodeCookieSession(),
        url: tenantWithoutMembership.applicationURL,
        httpOnly: true,
        sameSite: 'Lax',
        secure: false,
      },
    ]);

    await page.goto(`${tenantWithoutMembership.applicationURL}/staff`);

    await expect(page).toHaveURL(/\/staff$/);
    await expect(page.getByRole('heading', { name: 'Keanggotaan tidak tersedia' })).toBeVisible();
    await expect(page.getByText('Akun ini tidak memiliki keanggotaan aktif')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(authenticatedUserId);
    await expect(page.locator('body')).not.toContainText('no-membership@example.test');
  });

  test('denies the Property list before repository access when permission is missing', async ({
    context,
    page,
  }) => {
    test.skip(deterministicPropertyTests === 'NO_MEMBERSHIP', 'Property fixture is not selected.');
    const fixture = getPropertyFixture();
    await installAuthenticatedCookie(context, fixture.applicationURL);
    await page.goto(`${fixture.applicationURL}/staff/properties`);
    await expect(
      page.getByRole('heading', { name: 'Property belum dapat ditampilkan' }),
    ).toBeVisible();
    await fixture.grantActorPermissions();
  });

  test('lists selected Property A but not same-tenant Property B', async ({ context, page }) => {
    test.skip(deterministicPropertyTests === 'NO_MEMBERSHIP', 'Property fixture is not selected.');
    const fixture = getPropertyFixture();
    await installAuthenticatedCookie(context, fixture.applicationURL);
    await page.goto(`${fixture.applicationURL}/staff/properties`);
    await expect(page.getByRole('heading', { name: fixture.propertyA.name })).toBeVisible();
    await expect(page.getByText(fixture.propertyB.name)).toHaveCount(0);
  });

  test('rejects an invalid timezone and then creates a Property under broad scope', async ({
    context,
    page,
  }) => {
    test.skip(deterministicPropertyTests === 'NO_MEMBERSHIP', 'Property fixture is not selected.');
    const fixture = getPropertyFixture();
    await fixture.setActorAllProperties();
    await installAuthenticatedCookie(context, fixture.applicationURL);
    await page.goto(`${fixture.applicationURL}/staff/properties/new`);
    await fillRequiredPropertyFields(page, 'E2E Created Property', 'e2e-created-property');
    await page.getByLabel('Zona waktu IANA').fill('WIB');
    await page.getByRole('button', { name: 'Buat Property' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Periksa kembali data Property' }),
    ).toContainText('Periksa kembali data Property');
    await fillRequiredPropertyFields(page, 'E2E Created Property', 'e2e-created-property');
    await page.getByLabel('Zona waktu IANA').fill('Asia/Jakarta');
    await page.getByRole('button', { name: 'Buat Property' }).click();
    await expect(page).toHaveURL(/\/staff\/properties\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: 'E2E Created Property' })).toBeVisible();
  });

  test('edits an authorized Property successfully', async ({ context, page }) => {
    test.skip(deterministicPropertyTests === 'NO_MEMBERSHIP', 'Property fixture is not selected.');
    const fixture = getPropertyFixture();
    const editedName = 'E2E Property A Edited';
    await installAuthenticatedCookie(context, fixture.applicationURL);
    await page.goto(`${fixture.applicationURL}/staff/properties/${fixture.propertyA.id}`);

    await page.getByLabel('Nama').fill(editedName);
    await page.getByLabel('Deskripsi singkat').fill('Profil Property diperbarui lewat browser.');
    await submitServerActionAndReload(page, page.getByRole('button', { name: 'Simpan perubahan' }));

    await expect(page.getByRole('heading', { name: editedName })).toBeVisible();
    await expect(page.getByLabel('Nama')).toHaveValue(editedName);
    await expect(page.getByLabel('Deskripsi singkat')).toHaveValue(
      'Profil Property diperbarui lewat browser.',
    );
  });

  test('publishes, deactivates, republishes, and archives a Property', async ({
    context,
    page,
  }) => {
    test.skip(deterministicPropertyTests === 'NO_MEMBERSHIP', 'Property fixture is not selected.');
    test.setTimeout(60_000);
    const fixture = getPropertyFixture();
    await installAuthenticatedCookie(context, fixture.applicationURL);
    await page.goto(`${fixture.applicationURL}/staff/properties/${fixture.propertyB.id}`);

    await expect(page.getByText('DRAFT', { exact: true })).toBeVisible();
    await submitServerActionAndReload(page, page.getByRole('button', { name: 'Publish' }));
    await expect(page.getByText('PUBLISHED', { exact: true })).toBeVisible();

    await submitServerActionAndReload(page, page.getByRole('button', { name: 'Nonaktifkan' }));
    await expect(page.getByText('INACTIVE', { exact: true })).toBeVisible();

    await submitServerActionAndReload(page, page.getByRole('button', { name: 'Publish ulang' }));
    await expect(page.getByText('PUBLISHED', { exact: true })).toBeVisible();

    await submitServerActionAndReload(page, page.getByRole('button', { name: 'Arsipkan' }));
    await expect(page.getByText('ARCHIVED', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nonaktifkan' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Publish ulang' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Arsipkan' })).toHaveCount(0);
  });

  test('surfaces a stale version conflict and exposes only minimum scope-admin identity', async ({
    context,
    page,
  }) => {
    test.skip(deterministicPropertyTests === 'NO_MEMBERSHIP', 'Property fixture is not selected.');
    const fixture = getPropertyFixture();
    await installAuthenticatedCookie(context, fixture.applicationURL);
    await page.goto(`${fixture.applicationURL}/staff/properties/${fixture.propertyA.id}`);
    await fixture.advancePropertyVersion(fixture.propertyA.id);
    await page.getByLabel('Nama').fill('Stale update');
    await page.getByRole('button', { name: 'Simpan perubahan' }).click();
    await expect(page.getByRole('alert')).toContainText('Data berubah');

    await page.goto(`${fixture.applicationURL}/staff/property-access`);
    await expect(page.getByText(fixture.administratorMembershipId)).toBeVisible();
    await expect(page.locator('body')).not.toContainText('no-membership@example.test');
    await expect(page.locator('body')).not.toContainText('e2e-refresh-token');
  });

  test('grants and revokes selected Property scope through the minimum-field admin UI', async ({
    context,
    page,
  }) => {
    test.skip(deterministicPropertyTests === 'NO_MEMBERSHIP', 'Property fixture is not selected.');
    const fixture = getPropertyFixture();
    await installAuthenticatedCookie(context, fixture.applicationURL);
    await page.goto(`${fixture.applicationURL}/staff/property-access`);
    const targetMembership = page
      .getByRole('listitem')
      .filter({ hasText: fixture.administratorMembershipId });

    await expect(targetMembership.getByText('ALL_PROPERTIES', { exact: true })).toBeVisible();
    await targetMembership.getByLabel('Ganti mode').selectOption('SELECTED_PROPERTIES');
    await submitServerActionAndReload(
      page,
      targetMembership.getByRole('button', { name: 'Terapkan mode' }),
    );
    await expect(targetMembership.getByText('SELECTED_PROPERTIES', { exact: true })).toBeVisible();
    await expect(targetMembership).toContainText('0 grant aktif');

    const grantButton = targetMembership.getByRole('button', { name: 'Tambah grant' });
    await grantButton.locator('..').getByLabel('Property ID').fill(fixture.propertyA.id);
    await submitServerActionAndReload(page, grantButton);
    await expect(targetMembership).toContainText('1 grant aktif');

    const revokeButton = targetMembership.getByRole('button', { name: 'Cabut grant' });
    await revokeButton.locator('..').getByLabel('Property ID').fill(fixture.propertyA.id);
    await submitServerActionAndReload(page, revokeButton);
    await expect(targetMembership).toContainText('0 grant aktif');
  });
});

function getPropertyFixture(): PropertyFoundationFixture {
  test.skip(
    Boolean(process.env.E2E_SUPABASE_URL),
    'The deterministic Property fixture applies only to the built-in local auth provider.',
  );
  if (!propertyFoundation) throw new Error('The Property foundation fixture was not created.');
  return propertyFoundation;
}

async function installAuthenticatedCookie(
  context: import('@playwright/test').BrowserContext,
  applicationURL: string,
): Promise<void> {
  await context.addCookies([
    {
      name: authenticationCookieName(authenticationProviderURL),
      value: encodeCookieSession(),
      url: applicationURL,
      httpOnly: true,
      sameSite: 'Lax',
      secure: false,
    },
  ]);
}

async function submitServerActionAndReload(page: Page, button: Locator): Promise<void> {
  const actionPath = new URL(page.url()).pathname;
  const actionResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === actionPath,
  );
  await button.click();
  await actionResponse;
  await page.reload();
}

async function fillRequiredPropertyFields(
  page: import('@playwright/test').Page,
  name: string,
  slug: string,
): Promise<void> {
  await page.getByLabel('Nama').fill(name);
  await page.getByLabel('Slug').fill(slug);
  await page.getByLabel('Alamat baris 1').fill('Jalan Browser 1');
  await page.getByLabel('Kota/Kabupaten').fill('Sleman');
  await page.getByLabel('Provinsi').fill('DI Yogyakarta');
}

function authenticationCookieName(providerURL: string): string {
  const projectReference = new URL(providerURL).hostname.split('.')[0];
  return `sb-${projectReference}-auth-token`;
}

function encodeCookieSession(): string {
  const session = {
    access_token: accessToken,
    refresh_token: 'e2e-refresh-token',
    expires_in: 3_600,
    expires_at: 4_102_444_800,
    token_type: 'bearer',
    user: {
      id: authenticatedUserId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'no-membership@example.test',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      created_at: '2026-08-10T00:00:00.000Z',
    },
  };

  return `base64-${Buffer.from(JSON.stringify(session), 'utf8').toString('base64url')}`;
}

function createTestAccessToken(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString(
    'base64url',
  );
  const payload = Buffer.from(
    JSON.stringify({
      aud: 'authenticated',
      exp: 4_102_444_800,
      iat: 1_786_291_200,
      iss: `${authenticationProviderURL}/auth/v1`,
      role: 'authenticated',
      session_id: '36c5dc46-d873-47e9-856b-ee4559dd43d6',
      sub: authenticatedUserId,
    }),
    'utf8',
  ).toString('base64url');

  return `${header}.${payload}.e2e-signature`;
}
