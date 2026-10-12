/** Entity configurations (fields, columns, cascade deletes) shared by Setup and the onboarding wizard. */
import { BookOpen, Building2, DoorOpen, GraduationCap, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/tt/store";
import { uid, type AppState } from "@/lib/tt/types";
import type { EntityConfig } from "./EntityManager";

export type EntityKind = "departments" | "subjects" | "classes" | "lecturers" | "rooms";

export function useEntityConfigs(): Record<EntityKind, EntityConfig> {
  const { state, update } = useStore();
  const upsert = (k: EntityKind) => (item: any) => update((s) => {
    const list = s[k] as any[];
    return { ...s, [k]: list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item] };
  });
  const importer = (k: EntityKind) => (items: any[]) => update((s) => {
    const map = new Map((s[k] as any[]).map((x) => [x.id, x]));
    items.forEach((i) => map.set(i.id, i));
    return { ...s, [k]: [...map.values()] };
  });
  const dropSessions = (s: AppState, pred: (x: AppState["sessions"][number]) => boolean) => ({ ...s, sessions: s.sessions.filter((x) => !pred(x)) });
  const deptOpts = state.departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }));
  const subjOpts = state.subjects.map((x) => ({ value: x.id, label: `${x.code} ${x.name}` }));
  const dept = (id: string) => state.departments.find((d) => d.id === id)?.code ?? "—";
  const common = { settings: state.settings };

  return {
    departments: {
      ...common, title: "Departments", singular: "Department", icon: <Building2 className="h-6 w-6" />,
      description: "Academic departments that own subjects and classes.", items: state.departments,
      fields: [{ key: "code", label: "Code", type: "text", required: true }, { key: "name", label: "Name", type: "text", required: true }],
      columns: [{ label: "Code", render: (i) => <span className="font-semibold">{i.code}</span> }, { label: "Name", render: (i) => i.name }],
      newItem: () => ({ id: uid(), code: "", name: "" }), onSave: upsert("departments"), onImport: importer("departments"),
      onDelete: (id) => update((s) => ({ ...s, departments: s.departments.filter((d) => d.id !== id) })),
    },
    rooms: {
      ...common, title: "Rooms", singular: "Room", icon: <DoorOpen className="h-6 w-6" />,
      description: "Classrooms host theory periods; lab rooms host lab blocks.", items: state.rooms,
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "type", label: "Type", type: "select", required: true, options: [{ value: "classroom", label: "Classroom" }, { value: "lab", label: "Lab" }] },
        { key: "capacity", label: "Capacity", type: "number", required: true, min: 1, max: 1000 },
      ],
      columns: [
        { label: "Name", render: (i) => <span className="font-semibold">{i.name}</span> },
        { label: "Type", render: (i) => <Badge variant={i.type === "lab" ? "default" : "secondary"}>{i.type}</Badge> },
        { label: "Capacity", render: (i) => i.capacity },
      ],
      newItem: () => ({ id: uid(), name: "", type: "classroom", capacity: 60 }), onSave: upsert("rooms"), onImport: importer("rooms"),
      onDelete: (id) => update((s) => dropSessions({ ...s, rooms: s.rooms.filter((r) => r.id !== id) }, (x) => x.roomId === id)),
    },
    subjects: {
      ...common, title: "Subjects", singular: "Subject", icon: <BookOpen className="h-6 w-6" />,
      description: "Courses with their weekly hours. Labs are scheduled as consecutive blocks.", items: state.subjects,
      fields: [
        { key: "code", label: "Code", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
        { key: "deptId", label: "Department", type: "select", options: deptOpts },
        { key: "type", label: "Type", type: "select", required: true, options: [{ value: "theory", label: "Theory" }, { value: "lab", label: "Lab" }] },
        { key: "credits", label: "Credits", type: "number", required: true, min: 0, max: 10 },
        { key: "weeklyHours", label: "Weekly hours", type: "number", required: true, min: 1, max: 20 },
        { key: "labBlock", label: "Lab block (consecutive periods)", type: "number", min: 2, max: 3, showIf: (i) => i.type === "lab", hint: "Weekly hours must be a multiple of this." },
        { key: "heavy", label: "Heavy subject", type: "bool", hint: "Prefer morning slots" },
      ],
      validate: (i) => (i.type === "lab" && i.weeklyHours % i.labBlock !== 0 ? `Weekly hours (${i.weeklyHours}) must be a multiple of the lab block (${i.labBlock}).` : null),
      columns: [
        { label: "Code", render: (i) => <span className="font-semibold">{i.code}</span> },
        { label: "Name", render: (i) => i.name },
        { label: "Type", render: (i) => <Badge variant={i.type === "lab" ? "default" : "secondary"}>{i.type}{i.type === "lab" ? ` · ${i.labBlock}p` : ""}</Badge> },
        { label: "Hours/wk", render: (i) => i.weeklyHours },
        { label: "Dept", render: (i) => dept(i.deptId) },
      ],
      newItem: () => ({ id: uid(), code: "", name: "", deptId: state.departments[0]?.id ?? "", type: "theory", credits: 3, weeklyHours: 3, labBlock: 2, heavy: false }),
      onSave: upsert("subjects"), onImport: importer("subjects"),
      onDelete: (id) => update((s) => dropSessions({
        ...s, subjects: s.subjects.filter((x) => x.id !== id),
        classes: s.classes.map((c) => ({ ...c, subjectIds: c.subjectIds.filter((x) => x !== id) })),
        lecturers: s.lecturers.map((l) => ({ ...l, subjectIds: l.subjectIds.filter((x) => x !== id) })),
      }, (x) => x.subjectId === id)),
    },
    lecturers: {
      ...common, title: "Lecturers", singular: "Lecturer", icon: <Users className="h-6 w-6" />,
      description: "Faculty, the subjects they can teach, workload limits and unavailable slots.", items: state.lecturers,
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "email", label: "Email", type: "text" },
        { key: "subjectIds", label: "Subjects they can teach", type: "multi", options: subjOpts, required: true },
        { key: "maxPerDay", label: "Max hours per day", type: "number", required: true, min: 1, max: 12 },
        { key: "maxPerWeek", label: "Max hours per week", type: "number", required: true, min: 1, max: 60 },
        { key: "unavailable", label: "Unavailable slots", type: "slots", hint: "Tap slots when this lecturer cannot teach." },
      ],
      validate: (i) => (i.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email) ? "Enter a valid email address." : null),
      columns: [
        { label: "Name", render: (i) => <span className="font-semibold">{i.name}</span> },
        { label: "Subjects", render: (i) => <div className="flex flex-wrap gap-1">{i.subjectIds.map((id: string) => <Badge key={id} variant="outline">{state.subjects.find((x) => x.id === id)?.code}</Badge>)}</div> },
        { label: "Max/day · week", render: (i) => `${i.maxPerDay} · ${i.maxPerWeek}` },
        { label: "Unavailable", render: (i) => `${i.unavailable.length} slots` },
      ],
      newItem: () => ({ id: uid(), name: "", email: "", subjectIds: [], maxPerDay: 5, maxPerWeek: 18, unavailable: [] }),
      onSave: upsert("lecturers"), onImport: importer("lecturers"),
      onDelete: (id) => update((s) => dropSessions({ ...s, lecturers: s.lecturers.filter((l) => l.id !== id) }, (x) => x.lecturerId === id)),
    },
    classes: {
      ...common, title: "Classes", singular: "Class", icon: <GraduationCap className="h-6 w-6" />,
      description: "Sections (e.g. CSE-A, Year 2) and the subjects they take.", items: state.classes,
      fields: [
        { key: "name", label: "Name", type: "text", required: true, hint: "e.g. CSE-A" },
        { key: "year", label: "Year", type: "number", required: true, min: 1, max: 8 },
        { key: "deptId", label: "Department", type: "select", options: deptOpts },
        { key: "size", label: "Students", type: "number", required: true, min: 1, max: 1000 },
        { key: "subjectIds", label: "Subjects", type: "multi", options: subjOpts, required: true },
      ],
      columns: [
        { label: "Name", render: (i) => <span className="font-semibold">{i.name}</span> },
        { label: "Year", render: (i) => i.year },
        { label: "Students", render: (i) => i.size },
        { label: "Hours/wk", render: (i) => i.subjectIds.reduce((a: number, id: string) => a + (state.subjects.find((x) => x.id === id)?.weeklyHours ?? 0), 0) },
        { label: "Subjects", render: (i) => <div className="flex flex-wrap gap-1">{i.subjectIds.map((id: string) => <Badge key={id} variant="outline">{state.subjects.find((x) => x.id === id)?.code}</Badge>)}</div> },
      ],
      newItem: () => ({ id: uid(), name: "", year: 1, deptId: state.departments[0]?.id ?? "", size: 60, subjectIds: [] }),
      onSave: upsert("classes"), onImport: importer("classes"),
      onDelete: (id) => update((s) => dropSessions({ ...s, classes: s.classes.filter((c) => c.id !== id) }, (x) => x.classId === id)),
    },
  };
}
