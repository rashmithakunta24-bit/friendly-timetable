/** Colour-coded weekly grid with drag-and-drop (and tap-to-move on touch) editing. */
import { useMemo, useState } from "react";
import { AlertTriangle, Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import { DAY_SHORT, type AppState, type Session } from "@/lib/tt/types";

export const hueFor = (id: string) => {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return [195, 150, 85, 40, 15, 335, 285, 250, 120, 60][h % 10];
};

interface Props {
  state: AppState; sessions: Session[]; mode: "class" | "lecturer" | "room";
  editable?: boolean; clashIds?: Set<string>; todayIdx?: number; nowId?: string; nextId?: string;
  dayFilter?: number | null;
  canMove?: (id: string, day: number, period: number) => boolean;
  onMove?: (id: string, day: number, period: number) => void;
  onToggleLock?: (id: string) => void;
}

export function TimetableGrid({ state, sessions, mode, editable, clashIds, todayIdx, nowId, nextId, dayFilter, canMove, onMove, onToggleLock }: Props) {
  const { settings } = state;
  const [active, setActive] = useState<string | null>(null);
  const days = Array.from({ length: settings.days }, (_, d) => d).filter((d) => dayFilter == null || d === dayFilter);
  const { starts, covered } = useMemo(() => {
    const starts = new Map<string, Session[]>(), covered = new Set<string>();
    for (const s of sessions) {
      const k = `${s.day}-${s.period}`; starts.set(k, [...(starts.get(k) ?? []), s]);
      for (let i = 1; i < s.length; i++) covered.add(`${s.day}-${s.period + i}`);
    }
    return { starts, covered };
  }, [sessions]);
  const valid = useMemo(() => {
    const m = new Set<string>();
    if (!active || !canMove) return m;
    for (const d of days) settings.periods.forEach((p, i) => { if (!p.isBreak && canMove(active, d, i)) m.add(`${d}-${i}`); });
    return m;
  }, [active, canMove, settings, days.join()]);

  const name = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? "—";
  const drop = (d: number, p: number) => {
    if (!active) return;
    if (valid.has(`${d}-${p}`)) onMove?.(active, d, p);
    else onMove?.(active, d, p); // parent explains why it's blocked
    setActive(null);
  };

  return (
    <div className="overflow-x-auto rounded-xl border bg-card print:overflow-visible print:border-0">
      <table className="w-full min-w-[720px] border-separate border-spacing-1 p-1 text-sm">
        <thead>
          <tr>
            <th className="w-24 p-2 text-left text-xs font-medium text-muted-foreground">Time</th>
            {days.map((d) => (
              <th key={d} className={cn("rounded-md p-2 text-center font-display text-sm font-semibold", d === todayIdx ? "bg-primary text-primary-foreground" : "text-foreground")}>
                {DAY_SHORT[d]}{d === todayIdx && <span className="ml-1 text-xs font-normal">· Today</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {settings.periods.map((per, p) =>
            per.isBreak ? (
              <tr key={p}>
                <td className="px-2 py-1 text-xs text-muted-foreground">{per.start}</td>
                <td colSpan={days.length} className="rounded-md bg-muted py-1 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">{per.label}</td>
              </tr>
            ) : (
              <tr key={p}>
                <td className="px-2 py-1 align-top">
                  <div className="text-xs font-semibold text-foreground">{per.label}</div>
                  <div className="text-[11px] text-muted-foreground">{per.start}–{per.end}</div>
                </td>
                {days.map((d) => {
                  const k = `${d}-${p}`;
                  if (covered.has(k)) return null;
                  const here = starts.get(k);
                  if (!here) {
                    return (
                      <td key={d}
                        onDragOver={(e) => { if (active) e.preventDefault(); }}
                        onDrop={(e) => { e.preventDefault(); drop(d, p); }}
                        onClick={() => active && drop(d, p)}
                        className={cn("h-16 rounded-md border border-dashed border-border/60 transition-colors",
                          d === todayIdx && "bg-primary/5",
                          active && (valid.has(k) ? "cursor-pointer border-primary bg-primary/15" : "bg-destructive/10"))}
                        aria-label={active ? `Move here: ${DAY_SHORT[d]} ${per.label}` : `Free: ${DAY_SHORT[d]} ${per.label}`}
                      />
                    );
                  }
                  return (
                    <td key={d} rowSpan={Math.max(...here.map((s) => s.length))} className="align-top">
                      <div className="flex h-full flex-col gap-1">
                        {here.map((s) => {
                          const sb = state.subjects.find((x) => x.id === s.subjectId);
                          const clash = clashIds?.has(s.id);
                          const sub = mode === "class" ? [name(state.lecturers, s.lecturerId), name(state.rooms, s.roomId)]
                            : mode === "lecturer" ? [name(state.classes, s.classId), name(state.rooms, s.roomId)]
                            : [name(state.classes, s.classId), name(state.lecturers, s.lecturerId)];
                          return (
                            <div key={s.id}
                              draggable={editable && !s.locked}
                              onDragStart={(e) => { e.dataTransfer.setData("text/plain", s.id); setActive(s.id); }}
                              onDragEnd={() => setTimeout(() => setActive(null), 50)}
                              onClick={() => editable && !s.locked && setActive(active === s.id ? null : s.id)}
                              style={{ ["--h" as string]: hueFor(s.subjectId) }}
                              className={cn("tt-chip relative h-full min-h-14 rounded-md border-l-4 p-2 text-left",
                                editable && !s.locked && "cursor-grab active:cursor-grabbing",
                                active === s.id && "ring-2 ring-ring",
                                clash && "ring-2 ring-destructive",
                                s.id === nowId && "ring-2 ring-primary",
                                s.id === nextId && "outline-2 outline-dashed outline-primary")}
                              title={`${sb?.name} — ${sub.join(" · ")}`}>
                              <div className="flex items-start justify-between gap-1">
                                <span className="font-display text-xs font-bold leading-tight">{sb?.code}{sb?.type === "lab" && " · Lab"}</span>
                                <span className="flex gap-0.5">
                                  {clash && <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-label="Clash" />}
                                  {editable && (
                                    <button type="button" onClick={(e) => { e.stopPropagation(); onToggleLock?.(s.id); }}
                                      aria-label={s.locked ? "Unlock session" : "Lock session"} className="rounded p-0.5 hover:bg-background/40 print:hidden">
                                      {s.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5 opacity-50" />}
                                    </button>
                                  )}
                                  {!editable && s.locked && <Lock className="h-3 w-3" />}
                                </span>
                              </div>
                              <div className="mt-0.5 line-clamp-1 text-xs font-medium">{sb?.name}</div>
                              <div className="line-clamp-1 text-[11px] opacity-85">{sub.join(" · ")}</div>
                              {s.id === nowId && <span className="mt-1 inline-block rounded bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">NOW</span>}
                              {s.id === nextId && <span className="mt-1 inline-block rounded border border-primary px-1.5 text-[10px] font-semibold">NEXT</span>}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ),
          )}
        </tbody>
      </table>
      {editable && active && <p className="px-3 pb-2 text-xs text-muted-foreground print:hidden">Drop (or tap) a highlighted slot to move. Red slots would cause a clash.</p>}
    </div>
  );
}
