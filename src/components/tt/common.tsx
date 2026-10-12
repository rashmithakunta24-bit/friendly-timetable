/** Small shared UI pieces: confirm dialog, empty state, page header, slot picker. */
import type { ReactNode } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { DAY_SHORT, slotKey, type Settings } from "@/lib/tt/types";

export function Confirm({ trigger, title, description, action = "Delete", onConfirm }: { trigger: ReactNode; title: string; description: string; action?: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function Empty({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <div className="mb-3 rounded-full bg-secondary p-3 text-primary">{icon}</div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {text && <p className="mt-1 text-sm text-muted-foreground">{text}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2 print:hidden">{children}</div>}
    </div>
  );
}

/** Day × period checkbox grid used for lecturer unavailability. */
export function SlotPicker({ settings, value, onChange }: { settings: Settings; value: string[]; onChange: (v: string[]) => void }) {
  const set = new Set(value);
  const toggle = (k: string) => { set.has(k) ? set.delete(k) : set.add(k); onChange([...set]); };
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1 text-xs">
        <thead><tr><th />{settings.periods.map((p, i) => !p.isBreak && <th key={i} className="font-medium text-muted-foreground">{p.label}</th>)}</tr></thead>
        <tbody>
          {Array.from({ length: settings.days }, (_, d) => (
            <tr key={d}>
              <td className="pr-1 font-medium">{DAY_SHORT[d]}</td>
              {settings.periods.map((p, i) => !p.isBreak && (
                <td key={i}>
                  <button type="button" onClick={() => toggle(slotKey(d, i))} aria-pressed={set.has(slotKey(d, i))}
                    aria-label={`${DAY_SHORT[d]} ${p.label} ${set.has(slotKey(d, i)) ? "unavailable" : "available"}`}
                    className={cn("h-7 w-9 rounded border text-[10px] transition-colors", set.has(slotKey(d, i)) ? "border-destructive bg-destructive text-destructive-foreground" : "bg-background hover:bg-accent")}>
                    {set.has(slotKey(d, i)) ? "✕" : ""}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-display text-3xl font-bold", tone === "good" && "text-success", tone === "bad" && "text-destructive")}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm"><span className="truncate">{label}</span><span className="text-muted-foreground">{value}/{max} · {pct}%</span></div>
      <div className="h-2 rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cn("h-2 rounded-full", pct > 90 ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
