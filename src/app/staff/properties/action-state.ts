export interface PropertyActionState {
  status: 'idle' | 'error';
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const INITIAL_PROPERTY_ACTION_STATE: PropertyActionState = { status: 'idle' };
