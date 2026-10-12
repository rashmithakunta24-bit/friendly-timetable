/** Storage (localStorage) + React context store. */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { emptyState } from "./sample";
import type { AppState } from "./types";

const KEY = "clashfree:v1";

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...emptyState(), ...JSON.parse(raw) };
  } catch { /* corrupted data falls back to empty */ }
  return emptyState();
}
export function saveState(s: AppState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota */ }
}

interface Ctx { state: AppState; update: (fn: (s: AppState) => AppState) => void }
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  useEffect(() => setState(loadState()), []);
  const update = useCallback((fn: (s: AppState) => AppState) => {
    setState((s) => { if (!s) return s; const n = fn(s); saveState(n); return n; });
  }, []);
  if (!state) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  return <StoreCtx.Provider value={{ state, update }}>{children}</StoreCtx.Provider>;
}
export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}
