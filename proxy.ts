import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  resolveTenantSubdomainFromHost,
  type TenantHostResolutionOptions,
} from '@/modules/tenancy/subdomain';

export function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith('/qa') &&
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_ENABLE_QA !== 'true'
  ) {
    return NextResponse.rewrite(new URL('/404', request.url));
  }

  const requestHeaders = new Headers(request.headers);
  const tenantSubdomain = resolveTenantSubdomainFromHost(
    request.nextUrl.hostname,
    getTenantHostResolutionOptions(),
  );

  // This header is overwritten on every request. Downstream server code must
  // use it only after this proxy has normalized the actual request hostname.
  if (tenantSubdomain) {
    requestHeaders.set('x-lelungo-tenant-subdomain', tenantSubdomain);
  } else {
    requestHeaders.delete('x-lelungo-tenant-subdomain');
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

function getTenantHostResolutionOptions(): TenantHostResolutionOptions {
  return {
    rootDomain: process.env.LELUNGO_ROOT_DOMAIN ?? 'lelungo.com',
    localRootDomain: process.env.LELUNGO_LOCAL_ROOT_DOMAIN ?? 'localhost',
    allowLocalTenantHosts: process.env.LELUNGO_ENABLE_LOCAL_TENANT_HOSTS === 'true',
  };
}
