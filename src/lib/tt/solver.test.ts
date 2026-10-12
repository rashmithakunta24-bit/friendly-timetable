import { describe, expect, it } from "vitest";
import { sampleData } from "./sample";
import { findClashes, hoursReport, solve, checkMove } from "./solver";

describe("timetable solver with sample data", () => {
  const state = sampleData();
  const res = solve(state);

  it("produces a valid schedule", () => {
    expect(res.errors).toEqual([]);
    expect(res.ok).toBe(true);
  });
  it("has zero hard-constraint clashes", () => {
    expect(findClashes(state, res.sessions)).toEqual([]);
  });
  it("gives every subject exactly its weekly hours", () => {
    for (const r of hoursReport(state, res.sessions)) expect(r.scheduled).toBe(r.required);
  });
  it("places labs in lab rooms as 2-3 period blocks", () => {
    for (const s of res.sessions) {
      const sb = state.subjects.find((x) => x.id === s.subjectId)!;
      if (sb.type === "lab") {
        expect(state.rooms.find((r) => r.id === s.roomId)!.type).toBe("lab");
        expect([2, 3]).toContain(s.length);
      }
    }
  });
  it("respects lecturer unavailability", () => {
    const rao = res.sessions.filter((s) => s.lecturerId === "l-rao" && s.day === 0);
    for (const s of rao) expect([0, 1]).not.toContain(s.period);
  });
  it("blocks moves that create a class clash", () => {
    const st = { ...state, sessions: res.sessions };
    const a = res.sessions.find((s) => s.length === 1)!;
    const b = res.sessions.find((s) => s.classId === a.classId && s.id !== a.id && s.length === 1 && s.day !== a.day)!;
    expect(checkMove(st, res.sessions, a.id, b.day, b.period).ok).toBe(false);
  });
  it("explains failures when no schedule exists", () => {
    const bad = sampleData();
    bad.lecturers = bad.lecturers.map((l) => (l.id === "l-khan" || l.id === "l-bose" ? { ...l, subjectIds: [] } : l));
    const r = solve(bad);
    expect(r.ok).toBe(false);
    expect(r.errors[0].constraint).toBe("Qualified lecturer");
  });
});
