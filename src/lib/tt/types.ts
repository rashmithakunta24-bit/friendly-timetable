/** Core data model for ClashFree Timetable. All data lives in localStorage. */
export type ID = string;

export interface Department { id: ID; name: string; code: string }
export interface Subject {
  id: ID; name: string; code: string; credits: number; weeklyHours: number;
  type: "theory" | "lab"; /** consecutive periods per lab session (2-3) */ labBlock: number;
  /** heavy subjects are preferred in the morning */ heavy: boolean; deptId: string;
}
export interface ClassSection { id: ID; name: string; year: number; deptId: string; size: number; subjectIds: ID[] }
export interface Lecturer {
  id: ID; name: string; email: string; subjectIds: ID[]; maxPerDay: number; maxPerWeek: number;
  /** slot keys "day-periodIndex" */ unavailable: string[];
}
export interface Room { id: ID; name: string; type: "classroom" | "lab"; capacity: number }
export interface Period { label: string; start: string; end: string; isBreak: boolean }
export interface Settings { institution: string; days: 5 | 6; periods: Period[] }
export interface Session {
  id: ID; classId: ID; subjectId: ID; lecturerId: ID; roomId: ID;
  day: number; /** index into settings.periods */ period: number; length: number; locked: boolean;
}
export interface Notice { id: ID; ts: number; text: string; classId?: ID; kind: "change" | "substitution" | "info" }
export interface UnavailRequest { id: ID; lecturerId: ID; slots: string[]; note: string; status: "pending" | "approved" | "rejected"; ts: number }
export interface Auth { role: "admin" | "lecturer" | "student"; lecturerId?: ID; classId?: ID }

export interface AppState {
  settings: Settings;
  departments: Department[]; subjects: Subject[]; classes: ClassSection[]; lecturers: Lecturer[]; rooms: Room[];
  sessions: Session[];
  published: { sessions: Session[]; at: number } | null;
  notices: Notice[]; requests: UnavailRequest[];
  auth: Auth | null; onboardingDone: boolean;
}

export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const uid = () => Math.random().toString(36).slice(2, 10);
export const slotKey = (d: number, p: number) => `${d}-${p}`;
