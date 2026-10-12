/** Generic add/edit/delete table with form validation and CSV import/export. */
import { useRef, useState, type ReactNode } from "react";
import { Download, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Confirm, Empty, SlotPicker } from "./common";
import { download, parseCSV, toCSV } from "@/lib/tt/export";
import { uid, type Settings } from "@/lib/tt/types";

export interface Field {
  key: string; label: string; type: "text" | "number" | "select" | "multi" | "slots" | "bool";
  options?: { value: string; label: string }[]; required?: boolean; min?: number; max?: number; hint?: string;
  showIf?: (item: any) => boolean;
}
export interface EntityConfig {
  title: string; singular: string; description: string; icon: ReactNode;
  items: any[]; fields: Field[]; columns: { label: string; render: (i: any) => ReactNode }[];
  newItem: () => any; onSave: (item: any) => void; onDelete: (id: string) => void; onImport: (items: any[]) => void;
  validate?: (item: any) => string | null; settings: Settings;
}

export function EntityManager({ cfg }: { cfg: EntityConfig }) {
  const [editing, setEditing] = useState<any | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const validate = (item: any) => {
    const e: Record<string, string> = {};
    for (const f of cfg.fields) {
      if (f.showIf && !f.showIf(item)) continue;
      const v = item[f.key];
      if (f.required && (v === "" || v == null || (Array.isArray(v) && !v.length && f.type === "multi"))) e[f.key] = `${f.label} is required`;
      if (f.type === "text" && typeof v === "string" && v.length > 100) e[f.key] = "Max 100 characters";
      if (f.type === "number") {
        if (Number.isNaN(Number(v)) || v === "") e[f.key] = "Enter a number";
        else if (f.min != null && v < f.min) e[f.key] = `Minimum ${f.min}`;
        else if (f.max != null && v > f.max) e[f.key] = `Maximum ${f.max}`;
      }
    }
    const custom = cfg.validate?.(item);
    if (custom) e._ = custom;
    return e;
  };
  const save = () => {
    const item = { ...editing };
    for (const f of cfg.fields) if (typeof item[f.key] === "string" && f.type === "text") item[f.key] = item[f.key].trim();
    const e = validate(item); setErrors(e);
    if (Object.keys(e).length) return;
    cfg.onSave(item); toast.success(`${cfg.singular} saved`); setEditing(null);
  };
  const exportCSV = () => {
    const keys = ["id", ...cfg.fields.map((f) => f.key)];
    download(`${cfg.title.toLowerCase()}.csv`, toCSV([keys, ...cfg.items.map((i) => keys.map((k) => (Array.isArray(i[k]) ? i[k].join(";") : i[k])))]), "text/csv");
  };
  const importCSV = async (file: File) => {
    try {
      const rows = parseCSV(await file.text());
      const items = rows.map((r) => {
        const it = { ...cfg.newItem(), id: r.id || uid() };
        for (const f of cfg.fields) {
          if (!(f.key in r)) continue;
          const v = r[f.key];
          it[f.key] = f.type === "number" ? Number(v) : f.type === "bool" ? v === "true" : f.type === "multi" || f.type === "slots" ? (v ? v.split(";") : []) : v;
        }
        return it;
      }).filter((it) => Object.keys(validate(it)).length === 0);
      cfg.onImport(items);
      toast.success(`Imported ${items.length} of ${rows.length} rows`);
    } catch { toast.error("Could not read that CSV file"); }
  };
  const set = (k: string, v: unknown) => setEditing((e: any) => ({ ...e, [k]: v }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{cfg.description}</p>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importCSV(f); e.target.value = ""; }} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="mr-1 h-4 w-4" />Import CSV</Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!cfg.items.length}><Download className="mr-1 h-4 w-4" />Export CSV</Button>
          <Button size="sm" onClick={() => { setErrors({}); setEditing(cfg.newItem()); }}><Plus className="mr-1 h-4 w-4" />Add {cfg.singular.toLowerCase()}</Button>
        </div>
      </div>
      {!cfg.items.length ? (
        <Empty icon={cfg.icon} title={`No ${cfg.title.toLowerCase()} yet`} text={`Add your first ${cfg.singular.toLowerCase()} to get started.`}>
          <Button onClick={() => { setErrors({}); setEditing(cfg.newItem()); }}><Plus className="mr-1 h-4 w-4" />Add {cfg.singular.toLowerCase()}</Button>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>{cfg.columns.map((c) => <th key={c.label} className="px-4 py-3 font-medium">{c.label}</th>)}<th className="px-4 py-3 text-right font-medium">Actions</th></tr>
            </thead>
            <tbody>
              {cfg.items.map((it) => (
                <tr key={it.id} className="border-b last:border-0 hover:bg-muted/30">
                  {cfg.columns.map((c) => <td key={c.label} className="px-4 py-3 align-top">{c.render(it)}</td>)}
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${it.name ?? ""}`} onClick={() => { setErrors({}); setEditing({ ...it }); }}><Pencil className="h-4 w-4" /></Button>
                    <Confirm title={`Delete ${it.name ?? cfg.singular}?`} description="This also removes it from any timetable sessions and links. This cannot be undone."
                      onConfirm={() => { cfg.onDelete(it.id); toast.success(`${cfg.singular} deleted`); }}
                      trigger={<Button variant="ghost" size="icon" aria-label={`Delete ${it.name ?? ""}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{cfg.items.some((i) => i.id === editing?.id) ? "Edit" : "Add"} {cfg.singular.toLowerCase()}</DialogTitle>
            <DialogDescription>Fields marked * are required.</DialogDescription>
          </DialogHeader>
          {editing && (
            <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
              {cfg.fields.filter((f) => !f.showIf || f.showIf(editing)).map((f) => (
                <div key={f.key} className="grid gap-1.5">
                  <Label htmlFor={f.key}>{f.label}{f.required && " *"}</Label>
                  {f.type === "text" && <Input id={f.key} value={editing[f.key] ?? ""} maxLength={100} onChange={(e) => set(f.key, e.target.value)} />}
                  {f.type === "number" && <Input id={f.key} type="number" value={editing[f.key] ?? ""} min={f.min} max={f.max} onChange={(e) => set(f.key, e.target.value === "" ? "" : Number(e.target.value))} />}
                  {f.type === "bool" && <div className="flex items-center gap-2"><Switch id={f.key} checked={!!editing[f.key]} onCheckedChange={(v) => set(f.key, v)} /><span className="text-sm text-muted-foreground">{f.hint}</span></div>}
                  {f.type === "select" && (
                    <Select value={editing[f.key] || undefined} onValueChange={(v) => set(f.key, v)}>
                      <SelectTrigger id={f.key}><SelectValue placeholder={`Choose ${f.label.toLowerCase()}`} /></SelectTrigger>
                      <SelectContent>{f.options?.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                  {f.type === "multi" && (
                    <div className="grid max-h-48 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
                      {!f.options?.length && <span className="text-sm text-muted-foreground">Nothing to choose yet.</span>}
                      {f.options?.map((o) => (
                        <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent">
                          <Checkbox checked={(editing[f.key] ?? []).includes(o.value)}
                            onCheckedChange={(c) => set(f.key, c ? [...(editing[f.key] ?? []), o.value] : (editing[f.key] ?? []).filter((x: string) => x !== o.value))} />
                          {o.label}
                        </label>
                      ))}
                    </div>
                  )}
                  {f.type === "slots" && <SlotPicker settings={cfg.settings} value={editing[f.key] ?? []} onChange={(v) => set(f.key, v)} />}
                  {f.hint && f.type !== "bool" && <p className="text-xs text-muted-foreground">{f.hint}</p>}
                  {errors[f.key] && <p className="text-xs font-medium text-destructive">{errors[f.key]}</p>}
                </div>
              ))}
              {errors._ && <p className="text-sm font-medium text-destructive">{errors._}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
