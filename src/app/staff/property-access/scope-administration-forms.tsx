'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { INITIAL_SCOPE_ACTION_STATE, type ScopeActionState } from './action-state';
import {
  grantPropertyScopeAction,
  replacePropertyAccessModeAction,
  revokePropertyScopeAction,
} from './actions';

export function ScopeAdministrationForms({
  membershipId,
  version,
}: {
  membershipId: string;
  version: number;
}) {
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <ModeForm membershipId={membershipId} version={version} />
      <GrantForm
        action={grantPropertyScopeAction}
        label="Tambah grant"
        membershipId={membershipId}
        version={version}
      />
      <GrantForm
        action={revokePropertyScopeAction}
        label="Cabut grant"
        membershipId={membershipId}
        version={version}
      />
    </div>
  );
}

function ModeForm({ membershipId, version }: { membershipId: string; version: number }) {
  const [state, action] = useActionState(
    replacePropertyAccessModeAction,
    INITIAL_SCOPE_ACTION_STATE,
  );
  return (
    <form action={action} className="space-y-2 rounded-xl border border-border p-3">
      <input type="hidden" name="targetMembershipId" value={membershipId} />
      <input type="hidden" name="expectedVersion" value={version} />
      <label className="text-xs font-semibold">
        Ganti mode
        <select name="propertyAccessMode" className="input-base mt-1">
          <option value="SELECTED_PROPERTIES">SELECTED PROPERTIES (kosong)</option>
          <option value="ALL_PROPERTIES">ALL PROPERTIES</option>
        </select>
      </label>
      <ActionMessage state={state} />
      <Submit label="Terapkan mode" />
    </form>
  );
}

function GrantForm({
  action,
  label,
  membershipId,
  version,
}: {
  action: (state: ScopeActionState, formData: FormData) => Promise<ScopeActionState>;
  label: string;
  membershipId: string;
  version: number;
}) {
  const [state, formAction] = useActionState(action, INITIAL_SCOPE_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-2 rounded-xl border border-border p-3">
      <input type="hidden" name="targetMembershipId" value={membershipId} />
      <input type="hidden" name="expectedVersion" value={version} />
      <label className="text-xs font-semibold">
        Property ID
        <input name="propertyId" className="input-base mt-1" required />
      </label>
      <ActionMessage state={state} />
      <Submit label={label} />
    </form>
  );
}

function ActionMessage({ state }: { state: ScopeActionState }) {
  return state.status === 'error' ? (
    <p role="alert" className="text-xs text-red-700">
      {state.message}
    </p>
  ) : null;
}
function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
    >
      {pending ? 'Memproses…' : label}
    </button>
  );
}
