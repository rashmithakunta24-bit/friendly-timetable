/**
 * ClashFree Timetable — README
 * ----------------------------
 * 1. Sign in as Admin, Lecturer or Student (roles are local; data stays in this browser).
 * 2. Admin: run the Setup wizard (Rooms → Lecturers → Subjects → Classes → Generate) or "Load sample data".
 * 3. Generate, fine-tune by dragging sessions (clashes are blocked), lock sessions, then Publish.
 * 4. Students see the published timetable with now/next countdown; lecturers see "My schedule".
 * Modules: lib/tt/solver (constraints), lib/tt/store (localStorage), lib/tt/export (CSV/ICS/JSON), components/tt (UI).
 */
import { useEffect, useState } from "react";
import { CalendarCheck, CalendarDays, Database, GraduationCap, LayoutDashboard, LogOut, Menu, Moon, Settings2, ShieldCheck, Sun, UserCheck, Users, Wand2, Inbox, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StoreProvider, useStore } from "@/lib/tt/store";
import { cn } from "@/lib/utils";
import { Dashboard, DataPage, Generate, Requests, Setup, Substitute, TimetableEditor } from "./admin-pages";
import { MySchedule, StudentView, Wizard } from "./user-pages";

export default function ClashFreeApp() {
  return <StoreProvider><Root /></StoreProvider>;
}

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(localStorage.getItem("clashfree:theme") === "dark"); }, []);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); localStorage.setItem("clashfree:theme", dark ? "dark" : "light"); }, [dark]);
  return [dark, setDark] as const;
}

function Root() {
  const { state } = useStore();
  const theme = useTheme();
  return state.auth ? <Shell theme={theme} /> : <Login theme={theme} />;
}

function Logo() {
  return <div className="flex items-center gap-2"><div className="rounded-lg bg-primary p-1.5 text-primary-foreground"><CalendarCheck className="h-5 w-5" /></div><span className="font-display text-lg font-bold tracking-tight">ClashFree</span></div>;
}
function ThemeBtn({ theme: [dark, setDark] }: { theme: ReturnType<typeof useTheme> }) {
  return <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} aria-label="Toggle dark mode">{dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</Button>;
}

function Login({ theme }: { theme: ReturnType<typeof useTheme> }) {
  const { state, update } = useStore();
  const [role, setRole] = useState<"admin" | "lecturer" | "student">("admin");
  const [pick, setPick] = useState("");
  const opts = role === "lecturer" ? state.lecturers : role === "student" ? state.classes : [];
  const go = () => update((s) => ({ ...s, auth: { role, lecturerId: role === "lecturer" ? pick : undefined, classId: role === "student" ? pick : undefined } }));
  const roles = [
    { k: "admin", icon: ShieldCheck, t: "Admin", d: "Set up, generate and publish" },
    { k: "lecturer", icon: UserCheck, t: "Lecturer", d: "My schedule & availability" },
    { k: "student", icon: GraduationCap, t: "Student", d: "View my class timetable" },
  ] as const;
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <Logo />
        <div>
          <h1 className="font-display text-5xl font-bold leading-tight">Timetables without the clashes.</h1>
          <p className="mt-4 max-w-md text-lg opacity-90">Generate conflict-free schedules for classes, labs and faculty in seconds — then fine-tune with drag and drop.</p>
        </div>
        <div className="grid grid-cols-6 gap-1.5 opacity-40" aria-hidden>{Array.from({ length: 30 }, (_, i) => <div key={i} className={cn("h-8 rounded", i % 4 === 0 ? "bg-accent" : "bg-primary-foreground/30")} />)}</div>
      </div>
      <div className="flex flex-col p-6 sm:p-10">
        <div className="flex justify-between lg:justify-end"><span className="lg:hidden"><Logo /></span><ThemeBtn theme={theme} /></div>
        <div className="mx-auto my-auto w-full max-w-md py-10">
          <h2 className="font-display text-3xl font-bold">Welcome</h2>
          <p className="mt-1 text-muted-foreground">Choose how you want to sign in.</p>
          <div className="mt-6 grid gap-3" role="radiogroup" aria-label="Role">
            {roles.map((r) => (
              <button key={r.k} role="radio" aria-checked={role === r.k} onClick={() => { setRole(r.k); setPick(""); }}
                className={cn("flex items-center gap-3 rounded-xl border p-4 text-left transition-colors", role === r.k ? "border-primary bg-primary/10" : "bg-card hover:bg-accent")}>
                <r.icon className="h-6 w-6 text-primary" /><div><div className="font-semibold">{r.t}</div><div className="text-sm text-muted-foreground">{r.d}</div></div>
              </button>
            ))}
          </div>
          {role !== "admin" && (
            <div className="mt-4">
              {opts.length ? (
                <Select value={pick} onValueChange={setPick}>
                  <SelectTrigger aria-label={role === "lecturer" ? "Your name" : "Your class"}><SelectValue placeholder={role === "lecturer" ? "Select your name" : "Select your class"} /></SelectTrigger>
                  <SelectContent>{opts.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              ) : <p className="rounded-lg bg-muted p-3 text-sm">No {role === "lecturer" ? "lecturers" : "classes"} exist yet. Sign in as Admin first and load sample data.</p>}
            </div>
          )}
          <Button size="lg" className="mt-6 w-full" disabled={role !== "admin" && !pick} onClick={go}>Continue</Button>
        </div>
      </div>
    </div>
  );
}

function Shell({ theme }: { theme: ReturnType<typeof useTheme> }) {
  const { state, update } = useStore();
  const role = state.auth!.role;
  const nav = role === "admin" ? [
    ["dashboard", "Dashboard", LayoutDashboard], ["wizard", "Setup wizard", Sparkles], ["setup", "Setup", Settings2], ["generate", "Generate", Wand2],
    ["timetable", "Timetable", CalendarDays], ["substitute", "Substitutes", Users], ["requests", "Requests & notices", Inbox], ["data", "Data", Database],
  ] as const : role === "lecturer" ? [["mine", "My schedule", CalendarDays]] as const : [["student", "My timetable", CalendarDays]] as const;
  const [view, setView] = useState<string>(role === "admin" ? (!state.onboardingDone && !state.classes.length ? "wizard" : "dashboard") : nav[0][0]);
  const [open, setOpen] = useState(false);
  const pending = state.requests.filter((r) => r.status === "pending").length;
  const who = role === "lecturer" ? state.lecturers.find((l) => l.id === state.auth?.lecturerId)?.name : role === "student" ? `Student · ${state.classes.find((c) => c.id === state.auth?.classId)?.name ?? ""}` : "Administrator";
  const Nav = () => (
    <nav className="grid gap-1" aria-label="Main">
      {nav.map(([k, l, Icon]) => (
        <button key={k} onClick={() => { setView(k); setOpen(false); }} aria-current={view === k ? "page" : undefined}
          className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors", view === k ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent")}>
          <Icon className="h-4 w-4" />{l}{k === "requests" && pending > 0 && <span className="ml-auto rounded-full bg-accent px-2 text-xs text-accent-foreground">{pending}</span>}
        </button>
      ))}
    </nav>
  );
  const page = { dashboard: <Dashboard go={setView} />, wizard: <Wizard go={setView} />, setup: <Setup />, generate: <Generate go={setView} />, timetable: <TimetableEditor />, substitute: <Substitute />, requests: <Requests />, data: <DataPage />, mine: <MySchedule />, student: <StudentView /> }[view];
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar p-4 lg:flex print:hidden">
        <div className="mb-6 px-2"><Logo /></div><Nav />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-4"><SheetTitle className="mb-6"><Logo /></SheetTitle><Nav /></SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/90 px-4 py-2 backdrop-blur print:hidden">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
          <span className="lg:hidden"><Logo /></span>
          <div className="ml-auto flex items-center gap-1">
            <span className="hidden text-sm text-muted-foreground sm:inline">{who}</span>
            <ThemeBtn theme={theme} />
            <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => update((s) => ({ ...s, auth: null }))}><LogOut className="h-5 w-5" /></Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">{page}</main>
      </div>
    </div>
  );
}
