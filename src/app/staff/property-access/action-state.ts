export interface ScopeActionState {
  status: 'idle' | 'error';
  message?: string;
}

export const INITIAL_SCOPE_ACTION_STATE: ScopeActionState = { status: 'idle' };
