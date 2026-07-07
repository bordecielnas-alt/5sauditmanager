import { useSyncExternalStore } from "react";

export type Period = "week" | "month" | "year" | "all";
export type FilterState = {
  sites: string[] | "all";
  uaps: string[] | "all";
  gaps: string[] | "all";
  period: Period;
};

const KEY = "audit5s.filters.v1";
const defaultState: FilterState = { sites: "all", uaps: "all", gaps: "all", period: "all" };

let state: FilterState = load();
const subs = new Set<() => void>();

function load(): FilterState {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultState;
    const p = JSON.parse(raw);
    return { ...defaultState, ...p };
  } catch {
    return defaultState;
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

function emit() { subs.forEach((f) => f()); }

export function setFilters(patch: Partial<FilterState>) {
  state = { ...state, ...patch };
  persist(); emit();
}

export function useFilters(): [FilterState, (patch: Partial<FilterState>) => void] {
  const s = useSyncExternalStore(
    (cb) => { subs.add(cb); return () => subs.delete(cb); },
    () => state,
    () => defaultState,
  );
  return [s, setFilters];
}

// Utility: resolve "all" into a Set of ids given the full list, and produce a toggler.
export function resolveSelection(sel: string[] | "all", allIds: string[]): Set<string> {
  if (sel === "all") return new Set(allIds);
  return new Set(sel);
}
