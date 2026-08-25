type Listener = (pending: boolean) => void;

let pending = false;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener(pending);
}

export function startAppTransition(): void {
  if (pending) return;
  pending = true;
  emit();
}

export function endAppTransition(): void {
  if (!pending) return;
  pending = false;
  emit();
}

export function isAppTransitionPending(): boolean {
  return pending;
}

export function subscribeAppTransition(listener: Listener): () => void {
  listeners.add(listener);
  listener(pending);
  return () => {
    listeners.delete(listener);
  };
}
