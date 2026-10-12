# 00 — Audit Sistem Saat Ini dan Legacy Lelungo

> **Current implementation:** Aplikasi Next.js 16/React 19 travel-deal affiliate masih menjadi produk yang terlihat pengguna. Fondasi PMS yang tersedia hanya schema/migration tenancy dan RBAC, normalisasi host, resolusi/konteks tenant server-side, staff membership, katalog permission/role, serta pure authorization helpers; fondasi tersebut belum terhubung ke authentication adapter atau staff surface terlindungi.
> **Target state:** Brownfield modular monolith yang mempertahankan fondasi teknis layak pakai, mengganti asumsi affiliate secara bertahap, dan menambahkan domain PMS hanya melalui OpenSpec change terpisah dengan tenant, authorization, database, dan test boundary yang terverifikasi.
> **Decision status:** Audit evidence; bukan persetujuan untuk menghapus legacy, menjalankan migration, memilih provider, atau memulai fitur Phase 1. Keputusan target dimiliki ADR dan dokumen `01`-`12`.
> **Last verified:** 2026-08-09

## 1. Scope, metode, dan batas bukti

Audit ini menelusuri working tree repository melalui source/configuration review, `rg --files`, targeted `rg`, `git ls-files`, `git status --short`, pembacaan `package.json` dan lockfile v3, serta `npm.cmd ls --depth=0`. Area yang dibaca meliputi `src`, Prisma/migration, schema Supabase legacy, tests, workflow GitHub, environment templates, current/target docs, ADR, runbook, OpenSpec specs, dan OpenSpec changes aktif.

Audit ini sengaja documentation-only. Tidak ada runtime code, schema, migration, package, environment, external service, atau production state yang diubah.

### Batas verifikasi

- Tidak ada koneksi ke PostgreSQL/Supabase nyata, introspeksi schema ter-deploy, migration apply, backup/restore, atau cross-tenant integration test dalam audit ini.
- Tidak ada registry-currentness check yang dapat membuktikan package terbaru/abandoned dan tidak ada advisory lookup baru yang dicatat oleh dokumen ini. Versi “installed” berasal dari local install dan lockfile.
- Bukti build/test terakhir sebelum paket ini berasal dari [`docs/foundation/first-step-report.md`](../../foundation/first-step-report.md) dan [`docs/runbooks/session-handoff.md`](../../runbooks/session-handoff.md); hasil historis tersebut tidak dianggap otomatis sebagai rerun Phase 0.
- Formal automated security scan mencapai status **BLOCKED AT PREFLIGHT** pada 2026-08-09: command workflow dicoba dengan `python` lalu `py -3`, tetapi kedua launcher tidak tersedia pada host Windows. Source review di bawah bukan pengganti formal scan, penetration test, dependency advisory service, atau compliance review.
- Deployment preview yang disebut [`docs/runbooks/deployment.md`](../../runbooks/deployment.md) adalah bukti historis repository; status Vercel/GitHub/DNS/TLS/database saat ini tidak diperiksa ulang dari environment eksternal.
- File yang tidak memiliki consumer lokal masih mungkin dipakai oleh traffic, deployment, atau proses di luar repository. Karena itu kandidat removal tetap memerlukan telemetry/owner confirmation dan OpenSpec change tersendiri.

## 2. Kesimpulan eksekutif

Lelungo adalah brownfield, bukan greenfield PMS. Produk executable saat ini tetap sebuah halaman publik pencarian deal flight/hotel/package dengan mock data, pseudo-“AI insight”, redirect affiliate, dashboard insight, dan QA dashboard bermuatan data ilustratif. Tidak ada property management, availability, inventory, reservation, stay, guest, payment, finance, housekeeping, distribution, search index, audit log, worker, atau PMS reporting yang berjalan.

Fondasi baru yang dapat dibuktikan di source lebih sempit:

1. satu migration PostgreSQL additive untuk tenant/domain/staff membership/role/permission;
2. normalisasi wildcard subdomain di `proxy.ts` dan `src/modules/tenancy/subdomain.ts`;
3. repository/konteks tenant server-only dengan explicit selects;
4. katalog role/permission dan pure permission checks;
5. input validation untuk click analytics; dan
6. unit/E2E/CI scaffolding yang sehat untuk prototype, tetapi belum membuktikan database atau security boundary end-to-end.

Fondasi tersebut belum menjadi protected application flow. `getRequestTenantContext`, `createTenant`, `applyTenantScope`, dan `requireTenantPermission` tidak memiliki caller dari App Router saat audit. `ActorContext.userId` masih diberikan caller; membership tidak membuktikan request telah diautentikasi. OpenSpec change [`add-authenticated-membership-foundation`](../../../openspec/changes/add-authenticated-membership-foundation/proposal.md) merencanakan perbaikannya, tetapi seluruh task masih belum selesai dan tidak boleh dideskripsikan sebagai implementasi.

Implikasinya: strategi aman adalah mempertahankan prototype selama replacement surface belum ada, memperkuat authentication/database-isolation boundary lebih dahulu, lalu melakukan strangler migration per vertical slice. Big-bang rewrite atau penghapusan data affiliate belum memiliki bukti yang cukup.

## 3. Inventaris teknologi dan arsitektur aktual

| Area               | Current implementation                                                                                                                                 | Evidence stabil                                                                     | Gap/implikasi                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework aplikasi | Next.js App Router. Manifest meminta `next ^16.2.11`; lock/local install menunjukkan `16.3.0`.                                                         | `package.json`, `package-lock.json`, `src/app`, `proxy.ts`                          | Seluruh perubahan Next.js harus membaca guide terpasang di `node_modules/next/dist/docs/`; tidak ada backend service terpisah.                                                   |
| UI/runtime         | React dan React DOM `19.2.8`; homepage/dashboard utama adalah Client Components dengan Framer Motion.                                                  | `package.json`, `src/app/page.tsx`, `src/app/dashboard/page.tsx`, `src/components`  | Current UI sangat terikat konsep deal/AI affiliate dan client-side animation; bukan PMS shell.                                                                                   |
| Bahasa             | Strict TypeScript; installed `typescript 6.0.3`. `allowJs` dan `skipLibCheck` tetap aktif. Beberapa config menggunakan JavaScript CommonJS/ESM.        | `tsconfig.json`, `next.config.js`, `eslint.config.mjs`                              | Strict mode membantu, tetapi `skipLibCheck` mengurangi coverage type dependency dan mojibake masih ada pada source/docs legacy.                                                  |
| Runtime Node       | Policy `>=22`; `.node-version` dan CI memakai 22. Host audit menjalankan Node `v25.9.0`.                                                               | `package.json`, `.node-version`, `.github/workflows/*.yml`, output `node --version` | Local host bukan runtime CI; hasil yang sensitif versi perlu diulang pada Node 22.                                                                                               |
| Package manager    | npm only, `package-lock.json` lockfile v3; CI memakai `npm ci`. Tidak ada pnpm/Yarn/Bun lockfile.                                                      | `package.json`, `package-lock.json`, ADR 0003                                       | PowerShell host memblokir `npm.ps1`; `npm.cmd` berhasil. Ini masalah shell lokal, bukan alasan mengganti package manager.                                                        |
| Styling            | Tailwind CSS 3, PostCSS, Autoprefixer, global CSS variables, dark/light theme.                                                                         | `tailwind.config.js`, `postcss.config.js`, `src/app/globals.css`                    | Token visual dapat direfaktor; brand copy dan banyak utility composition masih affiliate-specific.                                                                               |
| Backend            | Next.js Route Handlers pada dua API route; business foundation berupa server-only module functions.                                                    | `src/app/api`, `src/modules`, `src/shared/database`                                 | Tidak ada BFF/versioned public API, server action bisnis, worker, scheduler, webhook, atau health endpoint.                                                                      |
| ORM                | Prisma Client + Prisma CLI 6.19.x untuk PostgreSQL.                                                                                                    | `prisma/schema.prisma`, `src/shared/database/prisma.ts`                             | Client `6.19.1` dan CLI `6.19.3` tidak selaras persis; migration belum integration-tested/applied pada database yang terverifikasi.                                              |
| Database           | PostgreSQL adalah target transactional store; Supabase SQL manual tetap mendefinisikan click analytics legacy.                                         | `prisma`, `supabase/schema.sql`                                                     | Dua persistence path hidup berdampingan. Keadaan deployment keduanya `UNKNOWN`.                                                                                                  |
| Authentication     | Tidak ada sign-in/out/callback, authoritative session verification, protected staff layout, atau request identity adapter.                             | `src/app`, `src/lib/supabase/*`, `src/modules/tenancy/tenant-context.ts`            | Auth-capable Supabase SDK/helper tidak sama dengan authentication implementation. Ini blocker protected PMS work.                                                                |
| Authorization      | Pure membership/permission helpers dan role catalog ada; membership query menyaring user, tenant, dan `ACTIVE`.                                        | `src/modules/identity`, `src/modules/tenancy/tenant-repository.ts`                  | Belum dihubungkan ke verified subject atau protected route/service; beberapa constraint scope database belum kuat.                                                               |
| Validation         | Zod untuk click payload, tenant creation input, dan subdomain normalization.                                                                           | `src/modules/analytics/click-event.ts`, `src/modules/tenancy`                       | Belum ada reusable environment schema, API error contract, rate limit, atau request-size policy.                                                                                 |
| Build              | Next `dev`, `build`, `start`, lint, typecheck, unit, E2E, format, Prisma, OpenSpec scripts tersedia.                                                   | `package.json`                                                                      | `build:prod` memakai sintaks Windows `set`, sehingga tidak portable ke Linux; script itu tidak dipakai CI saat ini.                                                              |
| Deployment         | Repository kompatibel dengan Vercel/managed Next hosting; metadata memakai Vercel URL fallbacks. Tidak ada tracked `vercel.json` atau deploy workflow. | `src/app/layout.tsx`, `.gitignore`, runbook deployment                              | Dua Vercel preview project dilaporkan historis (`lelungo`, `lelunngo`); canonical production project, promotion, wildcard DNS/TLS, dan production migration belum terverifikasi. |

## 4. Jalur request dan permukaan aplikasi

### 4.1 Jalur yang benar-benar reachable

```text
Browser
  -> Next.js proxy (QA gate + overwrite normalized tenant-subdomain header)
  -> App Router
     -> / dan /dashboard: mock deal/insight data di browser
     -> /qa: mock QA dashboard, hanya disembunyikan di production bila flag tidak true
     -> GET /api/deals: mock data + deterministic enrichment
     -> POST /api/track-click: Zod validation -> optional Supabase service-role insert
```

`proxy.ts` menghapus incoming `x-lelungo-tenant-subdomain` lalu mengisinya dari hostname yang lolos normalisasi. Ini kontrol penting, tetapi proxy hanya menghasilkan transport hint; ia tidak melakukan database resolution, authentication, membership authorization, atau property authorization.

### 4.2 Fondasi PMS yang ada tetapi belum wired

```text
normalized subdomain
  -> resolveTenantContext(caller-supplied ActorContext)
  -> TenantRepository.findBySubdomain()
  -> optional ACTIVE StaffMembership + role permissions
  -> requireTenantPermission()/applyTenantScope()
```

Targeted call-site search hanya menemukan definisi fungsi dan unit-test pure authorization; tidak ada page/route yang memanggil request-context, tenant-creation, permission, atau tenant-scope helpers. Karena itu source membuktikan library foundation, bukan protected tenant workflow.

### 4.3 Route inventory

| Route/artifact                              | Jenis                       | Data/side effect                            | Authentication/authorization            | Klasifikasi current                                                       |
| ------------------------------------------- | --------------------------- | ------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| `src/app/page.tsx` (`/`)                    | Client page                 | Local mock deals/insights                   | Public                                  | Legacy affiliate product, reachable.                                      |
| `src/app/dashboard/page.tsx` (`/dashboard`) | Client page                 | Local mock insight aggregation              | Public                                  | Legacy dashboard, bukan PMS analytics.                                    |
| `src/app/qa/page.tsx` (`/qa`)               | Server wrapper + dynamic UI | Mock test/bug/performance/conversion values | No user auth; production flag gate only | Internal-looking legacy mock; tidak boleh menerima real operational data. |
| `src/app/api/deals/route.ts`                | Public `GET`                | Returns enriched hard-coded deals           | None                                    | Legacy API; no external provider call.                                    |
| `src/app/api/track-click/route.ts`          | Public `POST`               | Optional insert to Supabase `clicks`        | None                                    | Legacy analytics; payload bounded, rate/abuse control absent.             |
| `src/app/opengraph-image.tsx`               | Generated image             | Static product metadata                     | Public                                  | Marketing artifact requiring rebrand.                                     |
| `src/app/layout.tsx`, `src/app/error.tsx`   | Composition/error           | Theme, footer, metadata, generic error UI   | Public                                  | Application shell partly reusable.                                        |

## 5. Peta repository dan ownership aktual

```text
/
├── src/app/                 Next.js transport, pages, metadata, route handlers
├── src/components/          Legacy marketing/deal UI + small UI primitives
├── src/internal/qa/         Mock internal-looking QA dashboard
├── src/hooks/               Client animation hook
├── src/lib/                 Legacy deal logic, Supabase/provider helpers, UI utilities
├── src/modules/
│   ├── analytics/           Click-event boundary schema only
│   ├── identity/            Role catalog + pure authorization
│   └── tenancy/             Host parsing, context, repository, tenant creation
├── src/shared/database/     Server-only Prisma singleton
├── src/types/               Legacy deal/affiliate types
├── prisma/                  Transactional schema + one append-only migration
├── supabase/                Manual legacy analytics SQL bootstrap
├── tests/unit/              Pure validation/subdomain/authorization tests
├── tests/e2e/               Browser tests for legacy public UI
├── .github/workflows/       Static/unit/build/audit CI + separate Playwright workflow
├── docs/                    Current/target/ADR/architecture/runbook memory
├── openspec/                Normative specs and active material changes
├── config/agentic/          Optional agent model-routing examples, not PMS runtime
└── package.json             npm scripts and declared dependency boundary
```

### Directory responsibility findings

- Dependency direction awal sebagian sesuai `app -> modules -> shared`: API click handler memakai analytics schema, dan tenancy memakai shared Prisma. Namun sebagian besar legacy UI langsung memakai `src/lib/mock-data.ts` dan `src/lib/insight-engine.ts`; belum ada application service boundary untuk product behavior.
- `src/modules/tenancy/tenant-service.ts` mengimpor public provisioning function dari identity dan mengoordinasikan satu Prisma transaction. Belum ada route consumer atau explicit platform authorization wrapper.
- `src/lib` mencampur domain-like deal scoring, provider adapter, persistence helper, formatting, SSR utility, theme, dan draggable widget. Folder ini bukan bounded context dan harus dikurangi secara incremental, bukan dipakai sebagai shared business-service dumping ground.
- `src/internal/qa` memiliki nama internal tetapi bukan trusted admin boundary. Flag exposure bukan authentication.
- `src/shared/database` tidak mengimpor domain dan memakai `server-only`; ini pola infrastructure yang dapat dipertahankan.
- `.next`, `node_modules`, `playwright-report`, `test-results`, `.vercel`, dan `*.tsbuildinfo` merupakan local/generated artifacts yang di-ignore; mereka bukan source of truth.

## 6. Data model, migration, dan data-access audit

### 6.1 Prisma/PostgreSQL foundation

`prisma/schema.prisma` dan migration `20260808100000_saas_tenancy_foundation` mendefinisikan:

| Object                   | Fungsi current                             | Constraint penting yang terlihat                                                         | Gap                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenants`                | Organization/isolation root teknis         | UUID PK, unique slug, lifecycle enum                                                     | Belum ada verified applied database; status semantics untuk request belum final.                                                                                                                    |
| `tenant_domains`         | Subdomain ke tenant                        | Unique subdomain, FK restrict, partial unique primary domain per tenant di migration SQL | Partial index tidak terwakili langsung di Prisma schema; integration behavior belum diuji.                                                                                                          |
| `staff_memberships`      | External user UUID ke tenant atau platform | FK tenant, status, tenant/user unique; partial unique platform user di SQL               | Membership bukan authentication. Platform/null uniqueness perlu PostgreSQL test.                                                                                                                    |
| `roles`                  | Platform/tenant role                       | Key/scope/optional tenant; partial unique platform key di SQL                            | Tidak ada check constraint yang menyelaraskan `scope` dengan nullability `tenant_id`.                                                                                                               |
| `permissions`            | Stable permission catalog                  | Globally unique key                                                                      | Banyak `booking.*`/payment/property permission mendahului domain implementasi; keberadaannya bukan feature.                                                                                         |
| `role_permissions`       | Role-to-permission join                    | Composite PK + FKs                                                                       | Provisioning idempotency hanya didesain di code, belum DB integration-tested.                                                                                                                       |
| `staff_membership_roles` | Membership-to-role join                    | Composite PK + FKs                                                                       | **High-risk gap:** tidak ada database constraint yang menjamin membership dan role berasal dari tenant/scope yang sama. Cross-tenant role assignment dapat direpresentasikan bila write path salah. |

Migration bersifat additive dan belum boleh dianggap deployed. Ia berisi partial unique indexes yang memperbaiki nullable uniqueness untuk platform membership/role, sehingga narasi lama yang mengatakan index tersebut “harus ditambahkan nanti” sudah tertinggal. Migration yang mungkin pernah dijalankan tidak boleh diedit; setiap perbaikan memakai forward migration terpisah setelah disposable PostgreSQL test.

Belum ada tabel Property, Room Type, Unit, Inventory, Availability, Rate Plan, Reservation, Guest, Stay, Payment, Invoice, Payout, Housekeeping, Maintenance, Distribution, Notification, Search, Analytics PMS, atau Audit Log.

### 6.2 Supabase legacy schema

`supabase/schema.sql` adalah script manual, bukan migration history Prisma. Ia mendefinisikan:

- `clicks` beserta indexes dan RLS; policy memperbolehkan insert, sementara tidak ada select policy biasa;
- `user_preferences` yang mengacu `auth.users` dan owner-scoped RLS;
- view `clicks_by_destination` dan `clicks_daily`.

Runtime repository hanya menunjukkan insert `clicks` dari `POST /api/track-click` memakai service-role client bila environment lengkap. Tidak ada consumer lokal untuk `user_preferences` atau analytics views. Keberadaan SQL file tidak membuktikan object tersebut pernah diterapkan. Click records mungkin memiliki nilai historis dan mengandung user-agent/referrer; keputusan retention/export/delete wajib mendahului destructive change.

### 6.3 Lokasi data access

| Lokasi                                     | Store/boundary            | Current behavior                                                                  | Temuan                                                                                                                                               |
| ------------------------------------------ | ------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/database/prisma.ts`            | Prisma singleton          | Server-only, environment-dependent logging                                        | Pola reusable; tidak ada validated startup config atau health check.                                                                                 |
| `src/modules/tenancy/tenant-repository.ts` | Prisma reads              | Minimal selects untuk tenant/membership/permissions                               | Tenant lookup menerima `PENDING`, `PROVISIONING`, `ACTIVE`, dan `SUSPENDED`; downstream status gate belum ada.                                       |
| `src/modules/tenancy/tenant-service.ts`    | Prisma transaction        | Creates tenant/domain, roles, owner membership                                    | Caller diwajibkan authorize platform actor melalui komentar, tetapi enforcement/application boundary belum ada. Tidak reachable dari route saat ini. |
| `src/modules/identity/role-catalog.ts`     | Prisma transaction client | Upsert permission, create/find roles, create-many mappings                        | Bounded loop; belum ada test terhadap PostgreSQL partial constraints atau concurrent provisioning.                                                   |
| `src/app/api/track-click/route.ts`         | Supabase service role     | Validates JSON, inserts click if configured, degrades without blocking navigation | Bypass RLS by design; public endpoint tidak rate-limited dan selalu merespons `tracked: true` walau persistence tidak terjadi.                       |
| `src/lib/supabase/server.ts`               | Supabase SSR/admin client | Cookie helper dan service-role factory                                            | Server-only; session helper belum menjadi auth boundary. Raw non-null env assertions dapat gagal terlambat.                                          |
| `src/lib/supabase/client.ts`               | Browser Supabase client   | Factory only                                                                      | Tidak ada local import; future auth change mungkin memerlukannya, jadi disposition belum final.                                                      |
| `src/lib/api/traveloka.ts`                 | External HTTP             | Server-only fetch wrapper                                                         | Tidak ada local consumer; provider contract/header masih asumsi dan endpoint allowlist/SSRF boundary belum dirancang.                                |

Tidak ditemukan raw SQL runtime atau broad Prisma `include` pada current module code. Ini bukan bukti keamanan database ter-deploy; formal query/security testing belum ada.

## 7. Authentication, tenancy, dan RBAC saat ini

### Kontrol yang sudah ada

- Hostname dinormalisasi terhadap root yang dikonfigurasi; malformed, reserved, unrelated, root, `www`, dan nested subdomain ditolak.
- Incoming tenant header ditimpa setiap request oleh `proxy.ts`, bukan dipercaya langsung.
- Tenant repository memilih field minimum dan membership query mengikat `userId`, `tenantId`, serta `status = ACTIVE`.
- `requireTenantPermission` menolak tenant mismatch, inactive membership, dan permission yang hilang.
- Tenant-scoped helper menolak conflicting caller-supplied tenant ID.
- Server-critical Prisma/Supabase/Traveloka/tenancy modules memakai `server-only` marker.

### Boundary yang belum selesai

- Tidak ada identity provider verification. `ActorContext.userId` dapat diberikan oleh caller function; tidak boleh berasal dari form/header/query.
- Tidak ada protected `/staff`/PMS route dan tidak ada call chain `validate -> authenticate -> tenant -> authorize -> service` yang executable.
- Tenant resolution mengembalikan context untuk `SUSPENDED` tenant dan pre-active statuses; policy operasi per status belum ditegakkan.
- Platform context ada sebagai union branch, tetapi platform authentication/permission/impersonation/audit flow belum ada.
- Permission catalog berisi capability domain masa depan; itu tidak membuktikan service, tabel, atau authorization check domain tersebut ada.
- Staff membership-role tenant/scope integrity belum dapat ditegakkan oleh constraint database yang terlihat.
- Tidak ada property-scoped access karena Property belum ada. Tenant permission saja tidak akan cukup untuk staf multi-property target.
- Tidak ada immutable audit record untuk tenant creation, role assignment, permission denial, atau support action.

## 8. Environment dan integration inventory

### 8.1 Application variables

| Variable                                      | Current consumer                                          | Exposure                          | Temuan                                                                                                                      |
| --------------------------------------------- | --------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                | Prisma datasource                                         | Server secret                     | Ada di `.env.example`; koneksi tidak diperlukan sampai Prisma flow dipanggil. Tidak ada central environment validation.     |
| `NEXT_PUBLIC_SUPABASE_URL`                    | Browser/server Supabase helpers, click route config check | Public                            | Optional untuk prototype; akan menjadi auth-path requirement hanya bila active auth change diterapkan.                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`               | Browser/server SSR helper                                 | Public by design                  | Ada di templates/CI; bukan service credential.                                                                              |
| `SUPABASE_SERVICE_ROLE_KEY`                   | Admin client untuk click insert                           | Server secret                     | Ada di `.env.local.example`, tetapi hilang dari canonical `.env.example` walau runtime memakainya. Inventory drift.         |
| `TRAVELOKA_BASE_URL`                          | Dormant server adapter                                    | Server configuration              | Contract/provider belum verified.                                                                                           |
| `TRAVELOKA_APP_KEY`                           | Dormant server adapter                                    | Server secret                     | Nama sudah tidak `NEXT_PUBLIC_*`; consumer lokal tidak ada.                                                                 |
| `LELUNGO_ROOT_DOMAIN`                         | Proxy host parsing                                        | Server configuration              | Default `lelungo.com`; wildcard DNS/TLS external belum verified.                                                            |
| `LELUNGO_LOCAL_ROOT_DOMAIN`                   | Proxy local parsing                                       | Server configuration              | Default localhost.                                                                                                          |
| `LELUNGO_ENABLE_LOCAL_TENANT_HOSTS`           | Proxy local parsing                                       | Server configuration              | Default false; kontrol aman untuk local wildcard.                                                                           |
| `NEXT_PUBLIC_SITE_URL`                        | Metadata base URL                                         | Public                            | Fallback ke Vercel-provided URL.                                                                                            |
| `NEXT_PUBLIC_ENABLE_QA`                       | Next production guard, proxy, QA page                     | Public flag                       | Digunakan runtime tetapi tidak ada pada `.env.example`/`.env.local.example`; production=true sengaja membuka mock QA route. |
| `NEXT_PUBLIC_APP_ENV`                         | Template dan CI                                           | Public                            | Tidak ditemukan consumer application source; kemungkinan informational residue.                                             |
| `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL` | Root metadata fallback                                    | Platform-provided/public hostname | Tidak perlu secret; deployment mapping eksternal.                                                                           |
| `BASE_URL`                                    | Playwright target                                         | Test-only                         | Tidak ada pada app template; didokumentasikan di runbook testing.                                                           |
| `PLAYWRIGHT_SKIP_WEBSERVER`, `CI`             | Playwright behavior                                       | Test/CI-only                      | Infrastructure test controls, bukan app runtime.                                                                            |

Agent gateway variables pada `config/agentic/env.example` tidak boleh dicampur dengan environment aplikasi. `.gitignore` menutup env lokal umum, `.vercel`, build, dan test artifacts; tidak ada real credential yang terlihat pada templates yang dibaca.

### 8.2 Integration inventory

| Integration                     | Current status                                                                    | Evidence                                       | Disposition audit                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| PostgreSQL melalui Prisma       | Schema/migration/client ada; connectivity/deployment unknown                      | `prisma`, `src/shared/database`                | KEEP sebagai transactional direction; verifikasi disposable/staging wajib sebelum feature persistence.          |
| Supabase Data/Auth-capable SDK  | Optional click persistence + unused client/session helpers; auth belum integrated | `src/lib/supabase`, track-click route          | KEEP terisolasi sementara; UPDATE SSR hanya melalui active auth OpenSpec; jangan anggap Supabase Auth berjalan. |
| Supabase SQL legacy             | Manual analytics bootstrap; applied state unknown                                 | `supabase/schema.sql`                          | DEPRECATE sebagai product domain; preserve/inspect data sebelum contract.                                       |
| Affiliate destinations          | Static outbound URLs ke Traveloka/Tiket/Agoda/Booking.com/AirAsia                 | `src/lib/mock-data.ts`                         | DEPRECATE bersama legacy user journey; tidak ada booking contract Lelungo.                                      |
| Traveloka-style API             | Dormant, unreferenced wrapper dengan assumed header contract                      | `src/lib/api/traveloka.ts`                     | REMOVE candidate setelah external-use confirmation; jangan membawa contract asumtif ke Distribution context.    |
| Unsplash images                 | Remote marketing images yang diizinkan Next Image config                          | `next.config.js`, mock data                    | DEPRECATE/replace saat marketplace media/storage vertical slice tersedia.                                       |
| Vercel                          | External Git integration/previews dilaporkan; production unknown                  | deployment runbook, metadata fallback          | INVESTIGATE canonical project, environment isolation, wildcard domain, promotion, rollback evidence.            |
| GitHub Actions                  | Dua tracked CI workflows                                                          | `.github/workflows`                            | KEEP dan perlu perluasan integration/security/deployment gates.                                                 |
| OpenCode/OpenSpec/model routing | Development governance/tooling only                                               | `opencode.jsonc`, `openspec`, `config/agentic` | KEEP di luar PMS runtime.                                                                                       |

Tidak ada payment provider, email, WhatsApp, object storage, upload, webhook receiver, queue, broker, cache, cron/scheduler, PostGIS, dedicated search, Sentry/APM, OpenTelemetry exporter, atau background worker yang diimplementasikan.

## 9. Dependency audit lokal

### 9.1 Arti disposition

- `KEEP`: cocok dengan current/target boundary dan ada penggunaan/bukti lokal.
- `UPDATE`: tetap dipakai, tetapi versi/alignment/API harus diperbarui melalui change terkontrol.
- `REPLACE`: fungsi tetap dibutuhkan tetapi library harus diganti setelah alternatif terbukti.
- `REMOVE`: tidak dibutuhkan setelah consumer legacy dihapus atau merupakan local-install residue; bukan izin menghapus sekarang.
- `INVESTIGATE`: bukti usage, compatibility, security, atau target need belum cukup.

Tidak ada dependency yang dipaksa masuk kategori `REPLACE`: repository lokal tidak memberi bukti bahwa ORM, test runner, atau UI library alternatif akan lebih aman. Memilih pengganti tanpa use case hanya memindahkan risiko.

### 9.2 Declared packages dan lock evidence

| Package/group                                                  | Manifest -> lock/local                                   | Disposition | Bukti dan tindak lanjut aman                                                                                                                                                                                      |
| -------------------------------------------------------------- | -------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next`, `react`, `react-dom`                                   | Next `^16.2.11` -> `16.3.0`; React `^19.2.8` -> `19.2.8` | KEEP        | Core runtime aktif. Selaraskan `eslint-config-next` pada change dependency berikutnya dan selalu gunakan guide Next terpasang.                                                                                    |
| `@prisma/client`, `prisma`                                     | client `6.19.1`; CLI `6.19.3`                            | UPDATE      | Direction benar, tetapi exact versions tidak selaras. Update/alignment harus meregenerasi client, validate schema, review SQL, dan menjalankan PostgreSQL integration tests; bukan aggressive upgrade.            |
| `@supabase/ssr`                                                | `^0.5.2` -> `0.5.2`                                      | UPDATE      | Active auth proposal memerlukan review cookie/cache API versi kompatibel. Belum boleh di-upgrade di Phase 0 documentation-only.                                                                                   |
| `@supabase/supabase-js`                                        | `^2.47.10` -> `2.106.1`                                  | KEEP        | Dipakai server/client helpers. SDK types harus berhenti di adapter; package dapat direview ulang bila provider auth berubah.                                                                                      |
| `zod`                                                          | `^3.24.2` -> `3.24.2`                                    | KEEP        | Dipakai pada external/system boundaries; target tetap membutuhkan schema validation.                                                                                                                              |
| `clsx`, `lucide-react`                                         | `2.1.1`, `0.468.0`                                       | KEEP        | Utility presentational kecil dan dipakai. Review accessibility/icon semantics bersama UI replacement.                                                                                                             |
| `framer-motion`                                                | `^11.15.0` -> `11.18.2`                                  | INVESTIGATE | Dipakai luas di legacy marketing UI dan button. Ukur kebutuhan/accessibility/performance pada design-system change sebelum retain atau remove.                                                                    |
| `recharts`                                                     | `^3.8.1` -> `3.8.1`                                      | REMOVE      | Consumer hanya dashboard/QA mock. Hapus package hanya setelah routes/components tersebut retired dan `rg`, typecheck, build, E2E membuktikan tidak ada consumer; charting PMS harus dievaluasi dari real metrics. |
| `tailwindcss`, `postcss`, `autoprefixer`                       | `3.4.19`, `8.5.26`, `10.5.0`                             | KEEP        | Build/style foundation aktif. Jangan major-upgrade bersamaan dengan product redesign tanpa separate compatibility/change plan.                                                                                    |
| `eslint`, `eslint-config-next`                                 | `9.39.5`, `16.2.11`                                      | UPDATE      | ESLint aktif; config Next tertinggal dari installed Next `16.3.0`. Selaraskan secara reviewed dan rerun lint/type/build.                                                                                          |
| `typescript`, `@types/*`                                       | TS `6.0.3`; Node types `22.19.19`; React types `19.2.x`  | KEEP        | Strict compilation aktif; CI runtime Node 22 sesuai Node types. Revisit `skipLibCheck` secara terpisah, jangan melemahkan type gate.                                                                              |
| `vitest`, `@playwright/test`                                   | `3.2.7`, `1.61.1`                                        | KEEP        | Unit/E2E runners aktif. Tambahkan PostgreSQL integration config dan domain/security coverage, bukan runner baru tanpa alasan.                                                                                     |
| `prettier`                                                     | `3.9.6`                                                  | KEEP        | Digunakan, tetapi current `format:check` tidak mencakup docs/app/components/config secara penuh. Perluas scope secara terkontrol.                                                                                 |
| `@fission-ai/openspec`                                         | `1.8.0`                                                  | KEEP        | Material-change workflow aktif dan repository-owned.                                                                                                                                                              |
| `sharp`/`postcss` overrides                                    | `sharp ^0.35.3`, `postcss ^8.5.15`                       | INVESTIGATE | Overrides pernah terkait safe dependency update. Jangan hapus sampai lock/advisory/build behavior dan alasan override diverifikasi ulang.                                                                         |
| `@emnapi/runtime`, `@img/sharp-wasm32` top-level local entries | `npm ls` menandai keduanya `extraneous`                  | REMOVE      | Bukan declared direct dependency. Verifikasi lewat clean `npm ci` pada workspace/disposable clone; jangan edit lock secara manual hanya untuk membersihkan local `node_modules`.                                  |

Catatan: caret ranges menjelaskan sebagian perbedaan manifest versus lock. `package-lock.json` adalah install authority CI. Audit ini tidak menjalankan `npm outdated`/registry metadata, sehingga klaim “terbaru” atau “abandoned” tetap `UNKNOWN`. Pada 2026-08-09, `npm.cmd audit --audit-level=critical --json --offline` keluar `0` dan melaporkan 0 vulnerability dari cache lokal. Hasil offline tersebut harus direkam sebagai bukti cache-lokal yang time-sensitive, bukan sebagai pemeriksaan registry terkini atau pengganti formal security scan.

## 10. Legacy product assumptions dan UI fitness

### 10.1 Asumsi lama yang terbukti di source

- Product taxonomy adalah `flight | hotel | package`, bukan Property/Room Type/Unit/Reservation.
- “Book now” berarti outbound affiliate navigation; Lelungo tidak memegang availability, price quote, reservation, confirmation, atau payment.
- `MOCK_DEALS`, `NORMAL_PRICES`, scarcity (`seatsLeft`, `bookedToday`), discount, dan “AI insights” dihitung/dideklarasikan lokal; tidak berasal dari inventory, market data, atau model AI.
- Destinations dan partner bersifat statis serta mencampur Indonesia dan internasional. Mereka tidak boleh dimigrasikan menjadi Property/location master data.
- Dashboard dan QA chart menampilkan operational-looking mock metrics tanpa backing store.
- Format umum memakai `en-US` dan default `USD`, walau legacy deals memakai IDR. Target money/location/localization memerlukan model baru, bukan patch copy.
- Home, navbar, footer, social proof, CTA, metadata, dan Open Graph masih menyebut hidden travel deals/AI/flight/hotel.
- Click analytics mencatat deal/destination/price/user-agent/referrer, bukan marketplace conversion/reservation event yang dapat dipercaya.
- Beberapa source/comment/string masih mengandung mojibake; text/encoding cleanup harus dilakukan pada file yang disentuh, bukan broad rewrite berisiko.

### 10.2 Classification dan migration evidence

Klasifikasi berikut menilai fitness terhadap PMS + direct marketplace, bukan kualitas visual semata.

| Artifact                                                                                                                | Klasifikasi | Alasan/evidence                                                                                                             | Migration/removal evidence yang diwajibkan                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/layout.tsx`, `error.tsx`, hydration guards                                                                     | REUSABLE    | Root composition, error boundary, dan hydration handling tidak memiliki business ownership kuat.                            | Rebrand metadata/footer; tambah accessibility/error tests; pastikan tidak ada sensitive diagnostics sebelum dipakai protected UI.                                                                               |
| `theme-provider.tsx`, `theme-toggle.tsx`, `src/lib/theme.ts`                                                            | REUSABLE    | Theme preference dan static bootstrap script bersifat lintas produk.                                                        | Tambahkan CSP hash/nonce strategy dan theme regression tests sebelum production hardening.                                                                                                                      |
| `src/components/ui/button.tsx`, `badge.tsx`                                                                             | REUSABLE    | Primitive kecil dan typed.                                                                                                  | Pisahkan default Framer Motion bila PMS accessibility/performance membutuhkan; review focus/disabled semantics dan visual tokens.                                                                               |
| `src/lib/format.ts`, `HydrationGuard`, `SkeletonCard`, animation hook                                                   | REFACTOR    | Pola teknis berguna, tetapi locale/currency/fallback/motion assumptions belum sesuai target.                                | Buat API format explicit locale/currency, accessibility reduced-motion, dan component tests; hindari penggunaan formatter legacy untuk money domain.                                                            |
| `src/app/globals.css`, Tailwind config, typography/color tokens                                                         | REFACTOR    | Foundation visual dapat dimanfaatkan, tetapi komentar/brand/gradient dan contrast belum dinilai untuk dua product surfaces. | Design-system review, token contract, WCAG checks, dan screenshot/component evidence sebelum dijadikan PMS/marketplace identity.                                                                                |
| `Navbar`, `Footer`, root marketing metadata/Open Graph                                                                  | REFACTOR    | Layout/navigation pattern mungkin berguna, copy/routes semuanya affiliate.                                                  | Tentukan IA Guest Web vs PMS Web, ganti route/copy, accessibility test, lalu switch tanpa memutus legacy route sebelum replacement siap.                                                                        |
| Home page, `DealGrid`, `DealCard`, `FilterBar`, `SmartSearchBar`, `AIInsightFeed`, `SocialProofCarousel`, `FloatingCTA` | DEPRECATE   | Reachable current product dan seluruh semantics deal/flight/hotel/affiliate.                                                | Pertahankan sampai marketplace vertical slice mencapai acceptance criteria. Migrate interaction pattern saja, bukan fake deal data; ukur traffic dan sediakan route transition/rollback.                        |
| `/dashboard` legacy insight page                                                                                        | DEPRECATE   | Reachable dan memakai mock deal aggregation, bukan PMS analytics.                                                           | Ganti dengan authenticated surface melalui separate change; jangan menaruh real tenant data pada public route yang sama sebelum auth/authorization evidence.                                                    |
| `/qa` dan `src/internal/qa`                                                                                             | REMOVE      | Operational-looking values semuanya hard-coded; flag bukan authentication.                                                  | Konfirmasi tidak dipakai release process, capture kebutuhan QA nyata, hapus pada approved change, lalu run route/build/E2E checks. Jangan migrasikan mock metrics menjadi records.                              |
| `SmartWidget.tsx` dan `src/lib/widget/*`                                                                                | REMOVE      | Targeted search hanya menemukan self-contained import chain; widget tidak dirender. Copy “AI Suggestion/Flights” legacy.    | Ulangi call-graph search pada clean tree, konfirmasi tidak ada dynamic/external import, hapus bersama tests/build verification dalam separate change.                                                           |
| `src/types/index.ts`, `mock-data.ts`, `insight-engine.ts`                                                               | DEPRECATE   | Deal types/data/scoring menjadi pusat prototype dan tidak cocok sebagai PMS aggregates.                                     | Jangan map flight/hotel deals menjadi Reservation/Property. Retain sampai legacy UI/API diputus; kemudian remove bersama consumer graph dan snapshots.                                                          |
| `GET /api/deals`                                                                                                        | DEPRECATE   | Hanya mengembalikan mock enrichment, public tanpa version contract.                                                         | Hentikan consumer UI lebih dulu, observasi traffic/external callers, beri transition behavior bila perlu, lalu remove melalui route regression tests.                                                           |
| `POST /api/track-click`, analytics schema/module                                                                        | DEPRECATE   | Affiliate-only side effect; bukan target event architecture.                                                                | Tentukan retention/legal/business value, export/anonymize bila diperlukan, stop producers, verifikasi no writes/reads, baru contract/drop lewat approved data change.                                           |
| `supabase/schema.sql` objects                                                                                           | UNKNOWN     | Repository tidak membuktikan object applied atau volume/data value.                                                         | Introspeksi environment yang diotorisasi, inventory policies/views/data, backup/export, owner sign-off, lalu class setiap object KEEP/MIGRATE/REMOVE.                                                           |
| `src/lib/api/traveloka.ts`                                                                                              | REMOVE      | Tidak memiliki local consumer; provider URL/header masih asumsi.                                                            | Konfirmasi tidak ada external invocation/secret dependency, revoke stale credential bila owner mengotorisasi, lalu delete adapter pada separate change. Future Distribution memakai verified provider contract. |
| `src/lib/supabase/client.ts` dan non-admin SSR helper                                                                   | UNKNOWN     | Tidak ada current consumer, tetapi active auth proposal bermaksud menggunakan Supabase session lifecycle.                   | Putuskan auth provider/change lebih dahulu; jangan delete sebelum auth implementation review atau pertahankan SDK hanya karena sudah terpasang.                                                                 |
| Legacy E2E specs dan filter snapshots                                                                                   | REFACTOR    | Memberi regression safety untuk current product, tetapi seluruh assertions menarget affiliate UI.                           | Pertahankan selama strangler migration; tambah test baru per replacement slice, kemudian retire old specs bersamaan dengan route, dengan recorded before/after coverage.                                        |

`REMOVE` pada tabel adalah candidate end-state, bukan instruksi penghapusan Phase 0. Setiap removal memerlukan replacement/lack-of-use evidence, data-preservation review, rollback, dan OpenSpec apply terpisah.

## 11. Testing dan quality audit

### 11.1 Coverage yang ada

| Layer           | Current evidence                                                  | Coverage aktual                                                                                                                           |
| --------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Unit            | `vitest.config.ts`, 3 files/9 tests                               | 4 subdomain parsing cases, 3 pure authorization cases, 2 click-schema cases. Node environment only.                                       |
| E2E             | `playwright.config.ts`, 4 specs/8 tests                           | Legacy homepage load, hydration locale, filters/rapid clicks, deal interaction, scroll, dark mode, AI redirect. Chromium only, retries 2. |
| Static          | ESLint Next config, TypeScript, Prettier, Prisma/OpenSpec scripts | Lint/typecheck/schema/spec/build gates ada; format scope terbatas.                                                                        |
| Integration/API | Tidak ada dedicated config/suite                                  | No real PostgreSQL, migration apply, repository, transaction, route-handler, Supabase, or provider contract test.                         |

Foundation report mencatat 9/9 unit, 8/8 production-browser E2E, lint/type/build/schema/spec PASS dan dependency audit bersih pada run terakhir. Report yang sama mencatat `next dev` hang pada Windows dan formal security scan blocked. Verification Phase 0 harus merekam rerun yang benar-benar dilakukan; retry atau unavailable layer tidak boleh disembunyikan.

### 11.2 Critical gaps

- Tidak ada authoritative authentication/session/cookie/cache/redirect/CSRF test.
- Tidak ada request-context test yang menghubungkan verified subject, trusted host, tenant lookup, active membership, dan permission denial.
- Tidak ada PostgreSQL test untuk migration viability, partial indexes, tenant-role scope, cross-tenant role assignment, repository scope, transaction rollback, atau tenant creation concurrency.
- Tidak ada tenant-owned business table, sehingga cross-tenant data isolation end-to-end belum mungkin dibuktikan.
- Tidak ada API tests untuk malformed JSON/body size, Supabase degradation/error semantics, generic errors, rate limit, atau cache headers.
- Tidak ada component/a11y test suite; E2E hanya Chromium desktop dan legacy UI.
- Future Reservation/Inventory wajib memiliki concurrency tests: overlapping physical unit, pooled inventory race, duplicate callback, hold expiry during payment, cancellation-versus-confirmation, and idempotent retry. Tidak satu pun dapat diklaim current.
- Tidak ada backup/restore, migration rollback/forward-fix rehearsal, staging smoke, production smoke, incident drill, performance/load, or observability alert test.
- Docs link, required status, ADR structure, bounded-context matrix, dan Mermaid integrity belum menjadi persistent CI gate pada baseline.

## 12. CI/CD, environment isolation, deployment, dan rollback audit

### 12.1 CI saat ini

`.github/workflows/ci.yml` menjalankan pada push/PR ke `main`: Node 22, `npm ci`, format check, Prisma validate/generate, OpenSpec validate, lint, typecheck, unit test, build, dan `npm audit --audit-level=critical`. Workflow terpisah menjalankan build + Chromium Playwright untuk `main`/`master` dan mengunggah report.

Gap CI:

- tidak ada PostgreSQL service atau `test:integration`;
- schema hanya divalidasi/generated, migration SQL tidak diaplikasikan;
- critical-only audit tidak menggantikan full advisory triage/formal security scan/secret scan/SAST;
- docs formatting/link/Mermaid/readiness checks tidak ada pada baseline;
- format check hanya meliputi module/shared/unit/proxy paths, bukan seluruh source/docs/config;
- E2E memakai retries 2; workflow perlu menampilkan retry/flakiness evidence, bukan hanya final green;
- Actions memakai moving major tags, bukan immutable commit SHA; supply-chain policy belum diputuskan;
- tidak ada deploy/promotion/migration workflow, environment approval, artifact provenance, or rollback automation.

### 12.2 Environment isolation

Repository memiliki kebijakan local/CI/staging/production terpisah di docs, tetapi implementation evidence hanya templates dan CI mock variables. Belum ada bukti resource inventory untuk development, preview, staging, dan production; belum ada enforcement bahwa preview tidak menunjuk production database; belum ada startup schema yang membedakan required/optional integrations; dan tidak ada secret rotation/ownership record.

Canonical `.env.example` belum menginventarisasi semua variable yang benar-benar dipakai (`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_ENABLE_QA`). Sebaliknya `NEXT_PUBLIC_APP_ENV` dideklarasikan tetapi tidak memiliki current application consumer. Drift ini harus diperbaiki pada change yang mengubah behavior terkait, tanpa memasukkan nilai nyata.

### 12.3 Deployment dan rollback

- Runbook menyatakan dua Vercel projects menerima preview pada 2026-08-09. Duplicate mapping adalah release risk; canonical production project belum dipilih.
- Tidak ada tracked platform configuration/IaC yang membuktikan wildcard `*.lelungo.com`, TLS, region, runtime limits, database attachment, storage, health check, log drain, alert, or backup/PITR.
- Production promotion dan database migration secara eksplisit belum terverifikasi. Tidak ada production change yang diotorisasi oleh audit ini.
- Runbook rollback sudah mengutamakan compatible application rollback dan reviewed forward-fix migration. Namun tidak ada bukti rollback drill, immutable artifact promotion, restore drill, RTO/RPO, atau staging-sized rehearsal.
- Migration tetap append-only. Jangan menjalankan `db push`, mengedit migration yang mungkin applied, atau otomatis menjalankan production migration dari web build/preview.

## 13. Security-focused source review

Tabel ini adalah repository observation, **bukan formal security finding set**. Severity menunjukkan prioritas engineering dari bukti lokal dan harus divalidasi oleh security workflow yang tersedia.

| Area                     | Kontrol yang terlihat                                                                                                            | Gap/risk saat ini                                                                                                                                                                | Prioritas                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Authentication/session   | Supabase cookie-capable helpers tersedia dan server helper memakai `server-only`                                                 | Tidak ada authoritative auth call, session lifecycle, protected route, cookie/cache policy, generic auth errors, atau verified subject.                                          | Critical blocker untuk staff/PMS        |
| Authorization/IDOR       | Pure tenant/permission denial helpers dan explicit membership selects                                                            | Helpers tidak wired; actor caller-supplied; platform/property scope absent; domain object authorization belum ada.                                                               | Critical blocker                        |
| Tenant isolation         | Host normalization, header overwrite, server lookup, tenant-scope helper                                                         | Suspended/pre-active tenants dapat di-resolve; no business-table proof; membership-role tenant mismatch possible at DB; no PostgreSQL tests.                                     | High                                    |
| Secrets/config           | Server credentials tidak bernama `NEXT_PUBLIC_*`; env values ignored; privileged modules marked server-only                      | Canonical env inventory incomplete; no centralized fail-closed validation; actual secret-store/rotation/deployment state unknown.                                                | High sebelum production                 |
| Input/mass assignment    | Strict Zod click schema; tenant/subdomain input validation                                                                       | No global body/rate limits; internal tenant service relies on caller authorization contract; future DTO/domain schemas absent.                                                   | Medium now, high for future mutations   |
| API exposure             | Only two small public APIs; errors mostly generic                                                                                | Click ingestion is unauthenticated/unthrottled; `/dashboard` public; QA flag is not auth; tracked semantics can claim success without persistence.                               | Medium                                  |
| Database/SQL injection   | Prisma query builder, Supabase builder, explicit selects; no runtime raw SQL found                                               | Applied schema/privileges unknown; service-role bypasses RLS; role-scope integrity constraints incomplete. Source observation cannot prove injection absence across future code. | High boundary risk                      |
| XSS/CSP/security headers | React escaping; theme `dangerouslySetInnerHTML` content is static; `poweredByHeader` disabled                                    | No CSP nonce/hash/header policy, HSTS/referrer/permissions policy evidence, or untrusted-content tests. External image origins allowed.                                          | Medium before public marketplace        |
| CSRF/open redirect       | No current privileged cookie mutation route                                                                                      | Therefore no current end-to-end control evidence. Active auth change correctly treats CSRF/redirect/cache as explicit boundaries, but tasks unfinished.                          | High before auth flow                   |
| SSRF/provider boundary   | Traveloka adapter server-only and unreferenced                                                                                   | Base URL + caller endpoint concatenation has no allowlist/verified contract; raw provider error may be logged. Must not accept untrusted endpoint.                               | Medium dormant risk                     |
| Upload/path traversal    | No upload, object storage, or filesystem endpoint                                                                                | “Absent” is not “secured”; MIME/size/path/private storage/signed URL/retention controls are future gates.                                                                        | Deferred blocker by feature             |
| Webhook/replay           | No webhook route                                                                                                                 | Signature, raw-body, timestamp/replay, idempotency, and secret rotation not implemented.                                                                                         | Deferred blocker by feature             |
| PII/privacy              | No guest/host PMS records; Prisma selects are narrow                                                                             | Clicks collect user-agent/referrer with no documented retention; guest/payment classification, deletion, encryption/access policy absent.                                        | High before guest/payment data          |
| Logging/observability    | Some payload logging intentionally avoided                                                                                       | Console errors remain unstructured; raw errors/provider messages may expose details; no request/correlation propagation, redaction library, metrics, tracing, alerting.          | High before operations                  |
| Auditability             | Role/membership tables exist                                                                                                     | Tidak ada append-only audit log atau actor/action/target/change record.                                                                                                          | High before privileged mutation         |
| Dependency/supply chain  | npm lock, `npm ci`, historical critical audit gate, dan offline npm audit 2026-08-09 melaporkan 0 vulnerability dari cache lokal | Registry-current advisory status tidak diverifikasi; tidak ada formal code/security scan evidence; workflow action pinning policy absent.                                        | Unknown/high-confidence gap in evidence |

No source evidence was found for stored passwords, access tokens in committed templates, direct guest/payment PII, upload paths, webhook secrets, or raw SQL runtime. Pernyataan ini terbatas pada file yang ditinjau dan tidak boleh dipromosikan menjadi “tidak ada vulnerability”.

## 14. Kontradiksi, drift, dan unknowns

### 14.1 Kontradiksi yang harus direkonsiliasi

| Source/claim                                                                                               | Bukti current                                                                                                                    | Resolusi Phase 0                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/audit/CODEBASE_AUDIT.md` menyatakan Prisma/tenancy/RBAC belum ada dan beberapa scripts absent.       | `prisma`, `src/modules/tenancy`, `src/modules/identity`, dan normalized scripts sekarang ada.                                    | Perlakukan audit tersebut sebagai historical pre-foundation snapshot 2026-08-08, bukan current canonical fact. Jangan hapus sejarah; cross-link ke audit ini. |
| `docs/current-system/current-data-model.md` mengatakan nullable platform uniqueness perlu later migration. | Existing migration sudah memiliki `staff_memberships_platform_user` dan `roles_platform_key` partial unique indexes.             | Perbarui current-system doc pada handoff; tetap integration-test constraint karena Prisma schema tidak mewakili partial index.                                |
| Current docs sering menyebut “active tenant context”.                                                      | `TenantRepository.findBySubdomain` juga menerima `PENDING`, `PROVISIONING`, dan `SUSPENDED`.                                     | Gunakan frasa “resolved non-archived tenant record” sampai status policy diputuskan/di-enforce.                                                               |
| `RequestTenantContext.actor` terlihat seperti authenticated actor.                                         | Production helper menerima `ActorContext` dari caller; tidak ada identity adapter/call site.                                     | Selalu label “caller-supplied actor seam” sampai active auth OpenSpec selesai dan verified.                                                                   |
| Foundation report menyebut foundation siap untuk master prompt.                                            | Report yang sama menyatakan auth, real DB migration/isolation, audit logging, formal scan, dan production deployment belum siap. | “Siap untuk prompt/change berikutnya” tidak sama dengan PMS/Phase 1/production ready. Final readiness report harus memakai gate konservatif.                  |
| Role catalog menggunakan `booking.*`; target package menggunakan Reservation.                              | Kode permission sudah ada, tetapi domain booking/reservation tidak ada.                                                          | Glossary menetapkan `Reservation` sebagai domain target; rename/mapping permission memerlukan compatibility decision, bukan silent edit.                      |
| Older target docs membagi Rooms/Bookings/Finance dengan istilah berbeda.                                   | Phase 0 bounded-context package melakukan redesign lebih lengkap.                                                                | Dokumen `01`-`12` menjadi canonical synthesis setelah diterima; existing target docs tetap supporting history.                                                |
| ADR tenancy berada di `docs/architecture`, ADR lain di `docs/adr`.                                         | Kedua roots tracked dan tenancy ADR sudah Accepted/historis.                                                                     | `docs/adr` adalah canonical root untuk ADR baru; cross-link ADR tenancy tanpa renumber/copy.                                                                  |

### 14.2 Unknowns yang tidak boleh diasumsikan

- Apakah Prisma migration atau `supabase/schema.sql` pernah diterapkan di development/staging/production, pada versi apa, dan dengan data volume berapa.
- Database host/provider, network policy, roles/least privilege, backups/PITR, restore success, staging parity, dan production retention.
- Current external traffic/caller untuk `/api/deals`, `/api/track-click`, `/dashboard`, `/qa`, serta adapter Traveloka yang tidak memiliki local import.
- Nilai bisnis/legal click analytics dan `user_preferences`, termasuk consent, retention, deletion, dan apakah tabel/views benar-benar ada.
- Canonical Vercel project, production domain/DNS/TLS, environment mapping, preview database isolation, production deployment, dan rollback artifact.
- Provider authentication final. Active OpenSpec mengusulkan Supabase Auth reuse, tetapi belum diterapkan atau diverifikasi dengan provider nyata.
- Current dependency/advisory/abandonment state di registry pada tanggal review final.
- Tenant lifecycle policy untuk `PENDING`, `PROVISIONING`, `SUSPENDED`, `FAILED`, dan `ARCHIVED` pada setiap product surface.
- Property-level staff scoping, legal/privacy requirements Indonesia, retention periods, RTO/RPO/SLA, payment/provider policy, dan business policy lainnya. Mereka milik fase target, bukan fakta current.

## 15. Safe migration disposition dan prioritas koreksi

Audit ini tidak memberi readiness verdict; [`LELUNGO-ARCHITECTURE-READINESS-REPORT.md`](./LELUNGO-ARCHITECTURE-READINESS-REPORT.md) adalah satu-satunya pemilik verdict akhir. Berdasarkan bukti current, urutan koreksi minimum yang aman adalah:

1. Selesaikan paket Phase 0, reconciliation, actual verification, dan explicit verdict tanpa runtime implementation.
2. Terapkan authoritative authentication-to-membership boundary hanya melalui OpenSpec change yang sudah ada atau direvisi; tetap deny by default.
3. Tambahkan disposable PostgreSQL migration/integration harness dan validasi partial uniqueness, role/membership scope, tenant isolation, serta transaction behavior.
4. Perbaiki schema integrity melalui forward migration baru bila test membuktikan defect; jangan edit migration lama.
5. Pilih canonical deployment project dan buktikan preview/staging/prod isolation, migration approval, backups, rollback, dan monitoring sebelum production promotion.
6. Perkenalkan Property vertical slice setelah security/data gates di atas; jangan memulai Reservation/Payment/Operations hanya karena permission names sudah ada.
7. Pertahankan legacy public UI selama replacement belum diterima. Deprecate producers/consumers, preserve/decide data, switch traffic, observe, baru remove.

### Artefak yang dapat dipertahankan sekarang

- Next.js/React/TypeScript/npm/CI/App Router baseline.
- Prisma/PostgreSQL direction dan server-only database singleton, setelah integration validation.
- Host normalization, trusted-header overwrite, minimum selects, tenant-scope/permission pure helpers, setelah authoritative auth/status/constraint gaps diperbaiki.
- Zod boundary-validation pattern.
- UI primitives/theme/hydration patterns setelah rebrand, accessibility, CSP, dan localization review.
- OpenSpec/ADR/runbook/repository-memory workflow.

### Artefak yang tidak boleh menjadi fondasi domain baru

- Deal/flight/hotel/package types, mock urgency/AI scoring, affiliate redirect, static normal prices, dan click schema.
- Public legacy dashboard/QA mock sebagai tempat real tenant data.
- Supabase service-role click client sebagai generic PMS repository.
- Traveloka assumed adapter sebagai Distribution contract.
- Current UI availability/price display sebagai source of truth reservation.

## 16. Audit evidence summary

| Pemeriksaan                                | Hasil audit ini              | Catatan                                                                                                                                                            |
| ------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source/config/schema/test/CI/doc inventory | OBSERVED                     | Ditelusuri dengan repository-local reads dan targeted search.                                                                                                      |
| `npm.cmd ls --depth=0`                     | VERIFIED untuk local install | Succeeded; menemukan declared packages plus dua extraneous entries. Tidak membuktikan registry currency/security.                                                  |
| Node host version                          | VERIFIED                     | `v25.9.0`; berbeda dari CI/support baseline Node 22.                                                                                                               |
| Git status saat inventory awal             | OBSERVED                     | Phase 0 OpenSpec change untracked; tidak ada legacy runtime modification yang dibuat oleh audit ini. Shared worktree kemudian menerima dokumentasi dari agen lain. |
| Runtime quality gates                      | BELUM DIREKAM DI DOKUMEN INI | Gunakan Phase 0 `verification.md`; jangan menyalin historical PASS tanpa rerun.                                                                                    |
| PostgreSQL/Supabase integration            | NOT RUN                      | Tidak ada disposable/authorized database pada scope audit.                                                                                                         |
| External deployment/DNS/TLS                | NOT RUN                      | Hanya historical repository evidence.                                                                                                                              |
| Formal automated security scan             | BLOCKED AT PREFLIGHT         | Pada 2026-08-09, launcher `python` dan `py -3` sama-sama tidak tersedia, sehingga scanner tidak mulai; source review bukan ekuivalen.                              |

Semua klasifikasi dalam audit ini adalah input untuk target design dan migration roadmap. Mengubah file legacy, dependency, database, deployment, atau external integration memerlukan change terpisah, verification aktual, dan otorisasi sesuai dampaknya.
