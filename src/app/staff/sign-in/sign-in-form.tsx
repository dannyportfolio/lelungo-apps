'use client';

import { useActionState } from 'react';

import { signInStaffAction, type StaffSignInState } from './actions';

const initialState: StaffSignInState = { status: 'idle' };

export function StaffSignInForm({ redirectTo }: { redirectTo: string }) {
  const [state, action, pending] = useActionState(signInStaffAction, initialState);

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={redirectTo} />

      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-semibold text-foreground">
          Email staf
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={state.fieldErrors?.email ? 'email-error' : undefined}
          className="input-base"
          placeholder="nama@properti.com"
        />
        {state.fieldErrors?.email ? (
          <p id="email-error" className="text-sm text-red-600">
            {state.fieldErrors.email[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-semibold text-foreground">
          Kata sandi
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby={state.fieldErrors?.password ? 'password-error' : undefined}
          className="input-base"
        />
        {state.fieldErrors?.password ? (
          <p id="password-error" className="text-sm text-red-600">
            {state.fieldErrors.password[0]}
          </p>
        ) : null}
      </div>

      {state.message ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? 'Memverifikasi...' : 'Masuk ke PMS'}
      </button>
    </form>
  );
}
