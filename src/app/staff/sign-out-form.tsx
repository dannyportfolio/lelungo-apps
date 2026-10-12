'use client';

import { useActionState } from 'react';

import { signOutStaffAction, type StaffSignOutState } from './actions';

const initialState: StaffSignOutState = { status: 'idle' };

export function StaffSignOutForm() {
  const [state, action, pending] = useActionState(signOutStaffAction, initialState);

  return (
    <form action={action}>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? 'Keluar...' : 'Keluar'}
      </button>
      {state.message ? (
        <p role="alert" className="mt-2 max-w-xs text-sm text-red-600">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
