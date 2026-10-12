'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import type { PropertyLifecycleIntent } from '@/modules/properties/property-constants';
import { INITIAL_PROPERTY_ACTION_STATE } from './action-state';
import { changePropertyLifecycleAction } from './actions';

export function PropertyLifecycleForm({
  propertyId,
  version,
  intent,
  label,
}: {
  propertyId: string;
  version: number;
  intent: PropertyLifecycleIntent;
  label: string;
}) {
  const [state, action] = useActionState(
    changePropertyLifecycleAction,
    INITIAL_PROPERTY_ACTION_STATE,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="expectedVersion" value={version} />
      <input type="hidden" name="intent" value={intent} />
      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      ) : null}
      <LifecycleButton label={label} />
    </form>
  );
}

function LifecycleButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl border border-border px-4 py-2 text-sm font-semibold disabled:opacity-60"
    >
      {pending ? 'Memproses…' : label}
    </button>
  );
}
