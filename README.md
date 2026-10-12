# Friendly Timetable

Build a complete, responsive web app called "ClashFree Timetable": a timetable generator for schools/colleges that creates clash-free schedules for classes, labs, and faculty. Deliver it as a complete web app with no backend needed that saves data in the browser's localStorage. Make it look clean, modern, and professional, and usable on phones as well as desktops.

## Two roles (login screen with role selection: Admin/Lecturer and Student)

### Lecturer / Admin view
1. Setup:
   - Add, edit, and delete: departments, courses/subjects (name, code, credits, weekly hours, theory or lab), classes/sections (e.g., CSE-A, Year 2), lecturers (name, subjects they can teach, max hours per day/week, unavailable slots), and rooms/labs (name, type, capacity).
   - Configure the working days (Mon-Fri or Mon-Sat), periods per day, period timings, and break/lunch slots.
   - Import/export data as CSV or JSON, plus a "Load sample data" button for demos.
2. Generator:
   - A "Generate Timetable" button that builds the schedule using a constraint-solving algorithm (backtracking or a genetic algorithm with a repair step).
   - Hard constraints (never violated):
     * A lecturer cannot be in two places at the same time.
     * A class/section cannot have two sessions in the same slot.
     * A room or lab cannot be double-booked.
     * Labs must be placed in lab rooms, in consecutive 2-3 period blocks.
     * Respect lecturer unavailability and room capacity.
     * Each subject gets exactly its required weekly hours.
   - Soft constraints (optimized):
     * Spread subjects evenly across the week and avoid the same subject twice a day.
     * Avoid gaps in a class's day and limit a lecturer's consecutive periods.
     * Put heavy subjects in the morning and keep lab sessions off the last period.
   - If no valid schedule exists, explain exactly which constraint failed and suggest fixes.
3. Editing:
   - Drag-and-drop to move sessions in the timetable grid, with live clash detection that highlights conflicts in red and blocks invalid moves.
   - Lock sessions so regeneration doesn't change them.
   - A "Substitute lecturer" tool that suggests free, qualified lecturers when someone is absent.
4. Output:
   - View by class, by lecturer, and by room, in a color-coded weekly grid.
   - Print-friendly layout, download as PDF, and export as CSV and iCal (.ics).
   - Publish button: published timetables become visible to students.
   - A dashboard with stats such as room utilization %, lecturer workload, and number of clashes (should be 0).

### Student view
- Choose or auto-load their class/section and see a read-only weekly timetable.
- Highlight "today" and "now/next class" with a countdown.
- Show subject, lecturer, room, and time for every slot, with filters for day and subject.
- Download/print the timetable and add it to a calendar (.ics).
- Notifications banner for changes or substitutions from lecturers.

### Lecturer personal view
- "My Schedule" showing only their own classes, free periods, and weekly workload, plus the option to mark slots as unavailable and send a request to the admin.

## UI/UX requirements
- Sidebar navigation, a light/dark mode toggle, and accessible colors (WCAG AA).
- Clear empty states, form validation, confirmation dialogs for deletes, and toast messages.
- A step-by-step onboarding wizard for first-time setup (Rooms -> Lecturers -> Subjects -> Classes -> Generate).

## Code quality
- Well-commented, modular JavaScript (separate functions for the solver, validation, rendering, and storage).
- Include a short README comment at the top explaining how to use it.
- Test the generator with the sample data and confirm it produces zero clashes before finishing.

Start by briefly stating your plan, then build it.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://friendly-timetable.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/42299b2b-e883-4a03-80e2-7d433c3d7ea7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
