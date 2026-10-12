import { createFileRoute } from "@tanstack/react-router";
import ClashFreeApp from "@/components/tt/App";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ClashFree Timetable — Clash-free school & college schedules" },
      { name: "description", content: "Generate clash-free timetables for classes, labs and faculty. Drag-and-drop editing, substitutes, exports and student view." },
      { property: "og:title", content: "ClashFree Timetable" },
      { property: "og:description", content: "Clash-free timetables for classes, labs and faculty in seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClashFreeApp,
});
