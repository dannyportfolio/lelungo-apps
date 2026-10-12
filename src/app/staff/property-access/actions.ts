'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { AuthorizationError } from '@/modules/identity/authorization';
import { requirePropertyScopeAdministrator } from '@/modules/identity/property-authorization';
import {
  PropertyScopeConflictError,
  PropertyScopeValidationError,
} from '@/modules/identity/property-scope-errors';
import {
  grantPropertyScope,
  replacePropertyAccessMode,
  revokePropertyScope,
} from '@/modules/identity/property-scope-service';
import { requireAuthenticatedTenantMembership } from '@/modules/tenancy/tenant-access';
import { getRequestTenantContext } from '@/modules/tenancy/tenant-context';
import type { ScopeActionState } from './action-state';

const MODE_FIELDS = new Set(['targetMembershipId', 'expectedVersion', 'propertyAccessMode']);
const GRANT_FIELDS = new Set(['targetMembershipId', 'expectedVersion', 'propertyId']);

function hasUnexpected(formData: FormData, allowed: ReadonlySet<string>): boolean {
  return [...formData.keys()].some((key) => !key.startsWith('$ACTION_') && !allowed.has(key));
}

function safeError(error: unknown): ScopeActionState {
  if (error instanceof AuthorizationError) return { status: 'error', message: 'Akses ditolak.' };
  if (error instanceof PropertyScopeConflictError)
    return { status: 'error', message: 'Scope berubah. Muat ulang lalu coba lagi.' };
  if (error instanceof PropertyScopeValidationError || error instanceof z.ZodError)
    return { status: 'error', message: 'Perubahan scope tidak valid.' };
  return { status: 'error', message: 'Scope belum dapat diubah.' };
}

async function authorityFor(targetMembershipId: string) {
  const context = requireAuthenticatedTenantMembership(await getRequestTenantContext());
  return {
    context,
    authority: requirePropertyScopeAdministrator(
      context.membership,
      context.tenant.id,
      targetMembershipId,
    ),
  };
}

export async function replacePropertyAccessModeAction(
  _state: ScopeActionState,
  formData: FormData,
): Promise<ScopeActionState> {
  try {
    if (hasUnexpected(formData, MODE_FIELDS)) throw new PropertyScopeValidationError();
    const targetMembershipId = String(formData.get('targetMembershipId') ?? '');
    const { context, authority } = await authorityFor(targetMembershipId);
    await replacePropertyAccessMode(
      authority,
      { userId: context.actor.userId, correlationId: context.correlationId },
      {
        targetMembershipId,
        expectedVersion: Number(formData.get('expectedVersion')),
        propertyAccessMode: String(formData.get('propertyAccessMode') ?? ''),
        selectedPropertyIds: [],
      },
    );
    revalidatePath('/staff/property-access');
    return { status: 'idle' };
  } catch (error) {
    return safeError(error);
  }
}

async function mutateGrantAction(
  operation: 'GRANT' | 'REVOKE',
  formData: FormData,
): Promise<ScopeActionState> {
  try {
    if (hasUnexpected(formData, GRANT_FIELDS)) throw new PropertyScopeValidationError();
    const targetMembershipId = String(formData.get('targetMembershipId') ?? '');
    const { context, authority } = await authorityFor(targetMembershipId);
    const command = {
      targetMembershipId,
      expectedVersion: Number(formData.get('expectedVersion')),
      propertyId: String(formData.get('propertyId') ?? ''),
    };
    const actor = { userId: context.actor.userId, correlationId: context.correlationId };
    if (operation === 'GRANT') await grantPropertyScope(authority, actor, command);
    else await revokePropertyScope(authority, actor, command);
    revalidatePath('/staff/property-access');
    return { status: 'idle' };
  } catch (error) {
    return safeError(error);
  }
}

export async function grantPropertyScopeAction(
  _state: ScopeActionState,
  formData: FormData,
): Promise<ScopeActionState> {
  return mutateGrantAction('GRANT', formData);
}

export async function revokePropertyScopeAction(
  _state: ScopeActionState,
  formData: FormData,
): Promise<ScopeActionState> {
  return mutateGrantAction('REVOKE', formData);
}
