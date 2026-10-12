/** Default settings, empty state and demo sample data. */
import type { AppState, Settings } from "./types";

export const defaultSettings = (): Settings => ({
  institution: "Riverside Institute of Technology",
  days: 5,
  periods: [
    { label: "P1", start: "09:00", end: "09:50", isBreak: false },
    { label: "P2", start: "09:50", end: "10:40", isBreak: false },
    { label: "Break", start: "10:40", end: "11:00", isBreak: true },
    { label: "P3", start: "11:00", end: "11:50", isBreak: false },
    { label: "P4", start: "11:50", end: "12:40", isBreak: false },
    { label: "Lunch", start: "12:40", end: "13:30", isBreak: true },
    { label: "P5", start: "13:30", end: "14:20", isBreak: false },
    { label: "P6", start: "14:20", end: "15:10", isBreak: false },
    { label: "P7", start: "15:10", end: "16:00", isBreak: false },
  ],
});

export const emptyState = (): AppState => ({
  settings: defaultSettings(),
  departments: [], subjects: [], classes: [], lecturers: [], rooms: [], sessions: [],
  published: null, notices: [], requests: [], auth: null, onboardingDone: false,
});

/** Realistic demo data: 2 departments, 3 sections, 10 lecturers, 7 rooms. */
export function sampleData(prev?: AppState): AppState {
  const s = emptyState();
  s.auth = prev?.auth ?? null;
  s.onboardingDone = true;
  s.departments = [
    { id: "d-cse", name: "Computer Science & Engineering", code: "CSE" },
    { id: "d-ece", name: "Electronics & Communication", code: "ECE" },
  ];
  const sub = (id: string, code: string, name: string, hrs: number, dept: string, o: Partial<{ lab: number; heavy: boolean; credits: number }> = {}) => ({
    id, code, name, weeklyHours: hrs, deptId: dept, credits: o.credits ?? (o.lab ? 2 : 4),
    type: (o.lab ? "lab" : "theory") as "lab" | "theory", labBlock: o.lab ?? 2, heavy: !!o.heavy,
  });
  s.subjects = [
    sub("s-ds", "CS201", "Data Structures", 4, "d-cse", { heavy: true }),
    sub("s-os", "CS202", "Operating Systems", 4, "d-cse", { heavy: true }),
    sub("s-db", "CS203", "Database Systems", 3, "d-cse", { credits: 3 }),
    sub("s-ma", "MA201", "Engineering Mathematics", 4, "d-cse", { heavy: true }),
    sub("s-en", "HS201", "Technical English", 2, "d-cse", { credits: 2 }),
    sub("s-dsl", "CS251", "Data Structures Lab", 3, "d-cse", { lab: 3 }),
    sub("s-dbl", "CS253", "Database Lab", 2, "d-cse", { lab: 2 }),
    sub("s-sg", "EC201", "Signals & Systems", 4, "d-ece", { heavy: true }),
    sub("s-ci", "EC202", "Electronic Circuits", 4, "d-ece", { heavy: true }),
    sub("s-dg", "EC203", "Digital Logic Design", 3, "d-ece", { credits: 3 }),
    sub("s-cil", "EC251", "Circuits Lab", 3, "d-ece", { lab: 3 }),
    sub("s-dgl", "EC253", "Digital Lab", 2, "d-ece", { lab: 2 }),
  ];
  s.classes = [
    { id: "c-csea", name: "CSE-A", year: 2, deptId: "d-cse", size: 60, subjectIds: ["s-ds", "s-os", "s-db", "s-ma", "s-en", "s-dsl", "s-dbl"] },
    { id: "c-cseb", name: "CSE-B", year: 2, deptId: "d-cse", size: 58, subjectIds: ["s-ds", "s-os", "s-db", "s-ma", "s-en", "s-dsl", "s-dbl"] },
    { id: "c-ecea", name: "ECE-A", year: 2, deptId: "d-ece", size: 55, subjectIds: ["s-sg", "s-ci", "s-dg", "s-ma", "s-en", "s-cil", "s-dgl"] },
  ];
  const lec = (id: string, name: string, subjects: string[], unavailable: string[] = []) => ({
    id, name, email: `${id.slice(2)}@riverside.edu`, subjectIds: subjects, maxPerDay: 5, maxPerWeek: 18, unavailable,
  });
  s.lecturers = [
    lec("l-rao", "Dr. Anita Rao", ["s-ds", "s-dsl"], ["0-0", "0-1"]),
    lec("l-verma", "Mr. Karan Verma", ["s-ds", "s-os", "s-dsl"]),
    lec("l-mehta", "Prof. Sunil Mehta", ["s-os"], ["4-6", "4-7", "4-8"]),
    lec("l-iyer", "Dr. Priya Iyer", ["s-db", "s-dbl"]),
    lec("l-khan", "Dr. Imran Khan", ["s-ma"]),
    lec("l-das", "Ms. Ritu Das", ["s-en"]),
    lec("l-nair", "Dr. Meera Nair", ["s-sg", "s-dg"]),
    lec("l-sen", "Prof. Arjun Sen", ["s-ci", "s-cil"]),
    lec("l-paul", "Ms. Neha Paul", ["s-dgl", "s-dbl", "s-dg"]),
    lec("l-bose", "Dr. Vikram Bose", ["s-ma", "s-sg"]),
  ];
  s.rooms = [
    { id: "r-101", name: "Room 101", type: "classroom", capacity: 70 },
    { id: "r-102", name: "Room 102", type: "classroom", capacity: 70 },
    { id: "r-103", name: "Room 103", type: "classroom", capacity: 65 },
    { id: "r-201", name: "Seminar Hall 201", type: "classroom", capacity: 120 },
    { id: "r-lab1", name: "CS Lab 1", type: "lab", capacity: 64 },
    { id: "r-lab2", name: "CS Lab 2", type: "lab", capacity: 64 },
    { id: "r-lab3", name: "Electronics Lab", type: "lab", capacity: 60 },
  ];
  return s;
}
