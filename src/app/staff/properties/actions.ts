'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { AuthorizationError } from '@/modules/identity/authorization';
import { requirePropertyCreationPermission } from '@/modules/identity/property-authorization';
import { requirePersistedPropertyPermission } from '@/modules/identity/property-authorization-service';
import {
  PropertyConflictError,
  PropertyNotFoundError,
  PropertyValidationError,
} from '@/modules/properties/property-errors';
import {
  createProperty,
  transitionPropertyLifecycle,
  updateProperty,
} from '@/modules/properties/property-service';
import { requireAuthenticatedTenantMembership } from '@/modules/tenancy/tenant-access';
import { getRequestTenantContext } from '@/modules/tenancy/tenant-context';
import type { PropertyActionState } from './action-state';

const CREATE_FIELDS = new Set([
  'name',
  'slug',
  'classificationKey',
  'timezone',
  'line1',
  'line2',
  'locality',
  'adminArea',
  'postalCode',
  'countryCode',
  'shortDescription',
  'publicWhatsAppE164',
  'amenityKeys',
]);
const UPDATE_FIELDS = new Set([...CREATE_FIELDS, 'propertyId', 'expectedVersion']);
const LIFECYCLE_FIELDS = new Set(['propertyId', 'expectedVersion', 'intent']);

function hasUnexpectedFields(formData: FormData, allowed: ReadonlySet<string>): boolean {
  return [...formData.keys()].some((key) => !key.startsWith('$ACTION_') && !allowed.has(key));
}

function nullableString(value: FormDataEntryValue | null): string | null {
  const stringValue = typeof value === 'string' ? value.trim() : '';
  return stringValue.length > 0 ? stringValue : null;
}

function profileFromForm(formData: FormData) {
  return {
    name: formData.get('name'),
    slug: formData.get('slug'),
    classificationKey: formData.get('classificationKey'),
    timezone: formData.get('timezone'),
    address: {
      line1: formData.get('line1'),
      line2: nullableString(formData.get('line2')),
      locality: formData.get('locality'),
      adminArea: formData.get('adminArea'),
      postalCode: nullableString(formData.get('postalCode')),
      countryCode: formData.get('countryCode'),
    },
    amenityKeys: formData.getAll('amenityKeys'),
    shortDescription: nullableString(formData.get('shortDescription')),
    publicWhatsAppE164: nullableString(formData.get('publicWhatsAppE164')),
  };
}

function safeActionError(error: unknown): PropertyActionState {
  if (error instanceof z.ZodError) {
    const fieldErrors = Object.fromEntries(
      Object.entries(error.flatten().fieldErrors).filter(
        (entry): entry is [string, string[]] => entry[1] !== undefined,
      ),
    );
    return {
      status: 'error',
      message: 'Periksa kembali data Property.',
      fieldErrors,
    };
  }
  if (error instanceof AuthorizationError) {
    return { status: 'error', message: 'Akses ditolak.' };
  }
  if (error instanceof PropertyNotFoundError) {
    return { status: 'error', message: 'Property tidak ditemukan.' };
  }
  if (error instanceof PropertyConflictError) {
    return { status: 'error', message: 'Data berubah. Muat ulang lalu coba lagi.' };
  }
  if (error instanceof PropertyValidationError) {
    return { status: 'error', message: 'Data Property tidak valid.' };
  }
  return { status: 'error', message: 'Perubahan belum dapat disimpan.' };
}

export async function createPropertyAction(
  _previousState: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  let destination: string | null = null;
  try {
    if (hasUnexpectedFields(formData, CREATE_FIELDS)) throw new PropertyValidationError();
    const context = requireAuthenticatedTenantMembership(await getRequestTenantContext());
    const authority = requirePropertyCreationPermission(context.membership, context.tenant.id);
    const created = await createProperty(
      authority,
      {
        userId: context.actor.userId,
        membershipId: context.membership.membershipId,
        correlationId: context.correlationId,
      },
      profileFromForm(formData),
    );
    destination = `/staff/properties/${created.id}`;
  } catch (error) {
    return safeActionError(error);
  }
  revalidatePath('/staff/properties');
  redirect(destination);
}

export async function updatePropertyAction(
  _previousState: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  try {
    if (hasUnexpectedFields(formData, UPDATE_FIELDS)) throw new PropertyValidationError();
    const context = requireAuthenticatedTenantMembership(await getRequestTenantContext());
    const propertyId = String(formData.get('propertyId') ?? '');
    const authority = await requirePersistedPropertyPermission({
      membership: context.membership,
      tenantId: context.tenant.id,
      propertyId,
      permission: 'property.manage',
      includeArchived: true,
    });
    await updateProperty(
      authority,
      {
        userId: context.actor.userId,
        membershipId: context.membership.membershipId,
        correlationId: context.correlationId,
      },
      {
        propertyId,
        expectedVersion: Number(formData.get('expectedVersion')),
        ...profileFromForm(formData),
      },
    );
    revalidatePath('/staff/properties');
    revalidatePath(`/staff/properties/${propertyId}`);
    return { status: 'idle' };
  } catch (error) {
    return safeActionError(error);
  }
}

export async function changePropertyLifecycleAction(
  _previousState: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  try {
    if (hasUnexpectedFields(formData, LIFECYCLE_FIELDS)) throw new PropertyValidationError();
    const intent = z
      .enum(['PUBLISH', 'DEACTIVATE', 'REPUBLISH', 'ARCHIVE'])
      .parse(formData.get('intent'));
    const propertyId = z.string().uuid().parse(formData.get('propertyId'));
    const context = requireAuthenticatedTenantMembership(await getRequestTenantContext());
    const authority = await requirePersistedPropertyPermission({
      membership: context.membership,
      tenantId: context.tenant.id,
      propertyId,
      permission: 'property.manage',
      includeArchived: true,
    });
    await transitionPropertyLifecycle(
      authority,
      {
        userId: context.actor.userId,
        membershipId: context.membership.membershipId,
        correlationId: context.correlationId,
      },
      intent,
      { propertyId, expectedVersion: Number(formData.get('expectedVersion')) },
    );
    revalidatePath('/staff/properties');
    revalidatePath(`/staff/properties/${propertyId}`);
    return { status: 'idle' };
  } catch (error) {
    return safeActionError(error);
  }
}
