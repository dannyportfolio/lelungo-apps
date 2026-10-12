import 'server-only';

import { headers } from 'next/headers';
import { cache } from 'react';

import { createSupabaseAuthenticatedSubjectProvider } from '@/modules/identity/supabase-authenticated-subject-provider';
import { composeRequestTenantContext } from './tenant-context-composer';
import type { RequestTenantContext } from './tenant-context-types';
import { TenantRepository } from './tenant-repository';

export {
  applyTenantScope,
  requireTenantContext,
  TenantResolutionError,
  type ActorContext,
  type RequestTenantContext,
  type TenantIdentity,
} from './tenant-context-types';

export const getRequestTenantContext = cache(async (): Promise<RequestTenantContext> => {
  const requestHeaders = await headers();
  const requestId = requestHeaders.get('x-request-id');

  return composeRequestTenantContext({
    tenantSubdomain: requestHeaders.get('x-lelungo-tenant-subdomain'),
    correlationId:
      requestId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
        ? requestId
        : crypto.randomUUID(),
    authenticatedSubjectProvider: createSupabaseAuthenticatedSubjectProvider(),
    repository: new TenantRepository(),
  });
});
