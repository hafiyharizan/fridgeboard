# Calendar, Markets Card and Idle Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Multi-day calendar events with a polished month grid and a "Next up" header; a swipeable News / Markets pair on Home; a dimmed idle screen with an optional photo slideshow.

**Architecture:** Three independent parts, in order. Part A adds a nullable `end_date` to `calendar_events` and expands multi-day events into one `ExpandedCalendarEvent` per covered day (`day_index`, `day_count`). Part B turns the stock strip into its own Markets card and wraps News + Markets in a drag-to-swipe carousel. Part C adds two per-device settings (dim, slideshow) and a local photo store in IndexedDB; no backend change.

**Tech Stack:** Next.js 16 (read `node_modules/next/dist/docs/` before writing routes/pages), React 19, Tailwind v4 + `workspace.css`, Framer Motion, Supabase, Vitest (node env, pure functions in `src/lib`).

**Spec:** No spec file. The requirements are the user's chat messages of 2026-11-07, summarised in Goal and in the Rulings below.

## Global Constraints

- Import types from `@/lib/types`; no `any`; no type assertion without a comment explaining why.
- Interactive animation uses Framer Motion, not CSS transitions. Exception: pure `:hover` colour/border states in `workspace.css` are allowed for the calendar grid (hover cannot be driven by Framer on 40 cells cheaply). State this in the commit message.
- Colours come from `workspace.css` tokens so light and dark themes both work.
- Touch targets at least 48px; text read across a kitchen at least 13px.
- Do not add `"use client"` to files that do not need it.
- Tests live beside source as `*.test.ts`, node environment, pure functions only.
- Migrations: new file in `supabase/migrations/` named `20261109000000_calendar_end_date.sql` (latest existing is `20261108000000_routines.sql`).
- Commands: `npm test`, `npm run lint`, `npm run build:local` must pass at the end of every task.

## Rulings (my calls, made because the user did not answer)

- **Photo source:** photos are chosen on each tablet and stored in that device's IndexedDB (no Supabase storage, no migration). Cost if wrong: photos are not shared across tablets.
- **Brightness:** the web cannot change hardware brightness. "Lowest brightness" means a near-black overlay on the idle view, on by default, switchable off.
- **"ASX":** the ASX 200 index, symbol `^AXJO` (already in use).
- **Multi-day and repeating are mutually exclusive:** the "Ends on" field is hidden when a repeat is set.
- **Reminders and push fire on the start day only.**

## Review Focus

- End date before start date (typed, or start moved after end): the form clamps it or blocks save; never stores an inverted range.
- A multi-day event that started in a previous month must still show on this month's grid and on the day sheet of any covered day.
- A multi-day event crossing a month or year boundary (30 Dec to 2 Jan) expands to the right day keys.
- Next-up with no events, only done events, only past events, and one still running today.
- Swipe on the carousel must not trigger the link taps inside news rows; a single-card state (stocks fail to load) must not show dots.
- Slideshow with zero photos, one photo, or a photo that fails to decode: falls back to the clock view without a blank screen.
- Dim overlay must not swallow the first-tap-to-wake behaviour.

---

## Part A: Calendar

### Task 1: Multi-day model, expansion and next-up logic

**Files:**
- Create: `supabase/migrations/20261109000000_calendar_end_date.sql`
- Modify: `src/lib/types.ts` (`CalendarEvent`, `ExpandedCalendarEvent`, `Database.calendar_events` Insert/Update)
- Modify: `src/lib/calendar.ts`
- Test: `src/lib/calendar.test.ts`

**Interfaces:**
- Produces: `CalendarEvent.end_date: string | null` (YYYY-MM-DD, null = single day); `ExpandedCalendarEvent.day_index: number` (1-based) and `day_count: number` (1 for single-day).
- Produces: `expandRecurrences(events, rangeStart, rangeEnd)` now emits one entry per covered day inside the range for events with `end_date`, each with `occurrence_date` = that day, `day_index`, `day_count`. Single-day and recurring events get `day_index: 1, day_count: 1`.
- Produces: `normalizeEndDate(start: string, end: string | null | undefined): string | null` returns null when end is empty or `<= start`.
- Produces: `findNextEvent(events: ExpandedCalendarEvent[], now: Date): ExpandedCalendarEvent | null` — first not-done event whose last covered day is today or later, ordered by occurrence date then time; for a multi-day event already running it returns the entry for today.
- Produces: `describeNextEvent(event: ExpandedCalendarEvent, now: Date): string` — "Today 3:00 PM", "Today · all day", "Tomorrow", "In 6 days", and for a running multi-day event "Day 2 of 4".

- [ ] **Step 1: Write failing tests in `src/lib/calendar.test.ts`**
  - `expands a 13–16 Nov event into four days` (range 2026-11-01..30: dates 13,14,15,16; `day_index` 1..4; `day_count` 4).
  - `includes a multi-day event that started before the range` (event 29 Oct..2 Nov, range 1..30 Nov → Nov 1 and 2 with `day_index` 4 and 5, `day_count` 5).
  - `crosses a year boundary` (2026-12-30..2027-01-02, range 2026-12-01..2027-01-31 → four entries, last `2027-01-02`).
  - `normalizeEndDate` returns null for "", undefined, equal to and before start; returns the end otherwise.
  - `findNextEvent`: empty → null; only done → null; past only → null; event today at a later time wins over tomorrow; a running 3-day event on day 2 is returned with `occurrence_date` = today.
  - `describeNextEvent` for each of the strings above.
- [ ] **Step 2: Run `npx vitest run src/lib/calendar.test.ts`; expect FAIL (functions/fields missing).**
- [ ] **Step 3: Add the migration** (`alter table public.calendar_events add column end_date text;` plus a check that `end_date is null or end_date > event_date`) **and the type changes.** Update every place that constructs a `CalendarEvent` or `ExpandedCalendarEvent` literal so `npm run lint` passes (grep `is_recurrence`).
- [ ] **Step 4: Implement the four functions in `src/lib/calendar.ts`.** Expansion walks day by day from `max(start, rangeStart)` to `min(end, rangeEnd)` using `Date` at local noon to avoid DST drift; `day_index` is the day offset from `event_date` + 1.
- [ ] **Step 5: Run `npm test`; expect all PASS. Run `npm run lint`.**
- [ ] **Step 6: Commit** `feat(calendar): multi-day events model, expansion and next-up helpers`.

### Task 2: "Ends on" in the add form, display of ranges

**Files:**
- Modify: `src/components/AddEventModal.tsx` (Draft gains `endDate`; `onAdd` payload gains `end_date?: string`)
- Modify: `src/hooks/useRealtimeCalendar.ts` (`addEvent` data type and insert row carry `end_date`)
- Modify: `src/components/CalendarDialogs.tsx` (pass-through, nothing if payload is spread)
- Modify: `src/components/DayDetailSheet.tsx`, `src/components/EventDetail.tsx` (show range and "Day N of M")
- Modify: `src/components/VoiceAdd.tsx` only if its insert type no longer compiles

**Interfaces:**
- Consumes: `normalizeEndDate`, `ExpandedCalendarEvent.day_index/day_count` from Task 1.
- Produces: `onAdd({... end_date?: string})`; hook inserts `end_date: normalizeEndDate(event_date, data.end_date)`.

- [ ] **Step 1:** In the form add a date input "Ends on (optional)" under the date line, `min` = next day after `dateKey`, hidden when `recurrence !== "none"`, cleared when a repeat is chosen. Include it in the parked `Draft`.
- [ ] **Step 2:** Submit sends `end_date` only when valid per `normalizeEndDate`; the input's `min` prevents inverted ranges and submit re-checks.
- [ ] **Step 3:** Day sheet and detail show "13 Nov – 16 Nov" and "Day 2 of 4" when `day_count > 1`. Day sheet already receives `expandRecurrences(rawEvents, day, day)`, so events started earlier appear without extra work; verify in the browser.
- [ ] **Step 4:** `npm run lint`, `npm test`, `npm run build:local`; expect PASS.
- [ ] **Step 5:** Manual check with `npm run dev`: add "Camping" 13/11 to 16/11, confirm four chips, clearing the end date makes it single-day. Report what you saw.
- [ ] **Step 6: Commit** `feat(calendar): end date on add form and range display`.

### Task 3: Grid polish and "Next up" header

**Files:**
- Modify: `src/components/CalendarGrid.tsx`, `src/components/CalendarTab.tsx`, `src/app/workspace.css` (calendar section near `.calendar-month-cell`, and the mobile block near line 2644)

**Interfaces:**
- Consumes: `findNextEvent`, `describeNextEvent`, `day_index/day_count` from Task 1; `useCalendarData()` provides `rawEvents`.

- [ ] **Step 1: Header.** Replace "What's coming up?" with the next event: eyebrow "Next up", heading = event title, subline = `describeNextEvent`. Clicking opens `onEvent`. Nothing upcoming → "Nothing coming up". Compute from `expandRecurrences(rawEvents, today, today + 60 days)`. Update the footer count to say "N notes this month" unchanged.
- [ ] **Step 2: Multi-day chips.** In `CalendarGrid`, chips with `day_count > 1` show the title on day 1 (and on the first cell of each week row) and "Title · day i/n" otherwise; first/last day get rounded left/right ends so the run reads as one bar.
- [ ] **Step 3: Hover and polish in CSS.** `.calendar-month-cell:hover` tint plus raised border and shadow token; a "+" add affordance in the cell corner that appears on hover/focus-within and calls `onDayClick`; today's day number in a filled circle; weekend columns slightly tinted; chip hover state; `title` tooltip keeps full text; `:focus-visible` rings. Respect `prefers-reduced-motion`. Keep hit areas at least 48px on touch.
- [ ] **Step 4:** Run `npm run lint`, `npm test`, `npm run build:local`; expect PASS.
- [ ] **Step 5:** Check light and dark (`data-theme="dark"`) and a 375px width in the browser; report what you saw.
- [ ] **Step 6: Commit** `feat(calendar): polished grid, multi-day bars, next-up header`.

---

## Part B: Markets card

### Task 4: Market symbols and number formatting

**Files:**
- Modify: `src/lib/stocks.ts`, `src/app/api/stocks/route.ts` (comments/limits only if needed)
- Test: `src/lib/stocks.test.ts`

**Interfaces:**
- Produces: `DEFAULT_STOCKS` = `[{SPUS "SPUS"}, {^AXJO "ASX 200"}, {AUDMYR=X "AUD/MYR"}, {MYRUSD=X "MYR/USD"}]` in that order; `stocksFromEnv` max stays 4.
- Produces: `formatPrice(quote)` shows 4 decimals for currency pairs (symbol ends `=X`) and 2 for others.

- [ ] **Step 1:** Add tests: defaults are exactly those four symbols/labels; `formatPrice` on a `MYRUSD=X` quote with price 0.2381 gives "0.2381"; on SPUS price 49.5 gives "49.50" (adjust to the existing `formatPrice` output style and keep existing tests green).
- [ ] **Step 2:** Run `npx vitest run src/lib/stocks.test.ts`; expect FAIL.
- [ ] **Step 3:** Change `DEFAULT_STOCKS` and `formatPrice`; update the "ASX 200 and the Aussie dollar" comment and the `/api/stocks` header comment.
- [ ] **Step 4:** `npm test`; expect PASS. Update the env table row in `CLAUDE.md` for `STOCK_SYMBOLS` defaults.
- [ ] **Step 5: Commit** `feat(markets): SPUS, ASX 200, AUD/MYR, MYR/USD defaults`.

### Task 5: Markets card and swipe carousel

**Files:**
- Create: `src/components/SwipeDeck.tsx` (generic: `children: ReactNode[]`, labels, drag + dots + arrow keys)
- Modify: `src/components/HomeDashboard.tsx` (`NewsCard` loses the strip and the `useStocks` call; new `MarketsCard`; `<NewsCard />` at the line ~707 becomes `<SwipeDeck>` of both)
- Modify: `src/app/workspace.css` (`.swipe-deck`, `.swipe-dots`, markets card tiles; remove or reuse `.stock-strip`)

**Interfaces:**
- Produces: `SwipeDeck({ cards: { id: string; label: string; node: ReactNode }[] })`. One card renders with no dots. Swiping past a threshold (offset 60px or velocity 400) changes the index; Framer `drag="x"` with `dragConstraints` zero and `dragElastic`.
- Consumes: `useStocks()` from `hooks/useAmbient.ts` (returns `StockQuote[]`), `formatChange`, `formatPrice`.

- [ ] **Step 1:** `MarketsCard`: header "Markets" with `TrendingUp` icon, four tiles (label, price, change with up/down colour from tokens), loading skeleton, and an empty state when `quotes` is empty. Deck shows only the News card when there are no quotes after load.
- [ ] **Step 2:** `SwipeDeck`: horizontal swipe, dots (48px tap targets), Left/Right arrow keys when focused, `aria-roledescription="carousel"`; card change animated by Framer. Links inside news rows keep working: ignore click if the pointer moved over 8px (set a ref in `onDragStart`, clear in `onDragEnd`).
- [ ] **Step 3:** Keep the "More news" dialog on the news card; remove its `StockStrip`. The deck must keep the grid cell's one-screen height (no growth); verify at 1280×800 with no scroll.
- [ ] **Step 4:** `npm run lint`, `npm test`, `npm run build:local`; expect PASS.
- [ ] **Step 5:** Browser check at 1280×800 and 375px: swipe/drag both ways, dots, keyboard, a news link tap still opens. Report what you saw.
- [ ] **Step 6: Commit** `feat(home): swipeable News and Markets cards`.

---

## Part C: Idle screen

### Task 6: Idle dim and slideshow settings, pure rules

**Files:**
- Modify: `src/lib/kitchen.ts`, `src/lib/kitchen.test.ts`
- Modify: `src/hooks/useKitchenDisplay.ts` (expose `idleDim`, `slideshow` and setters, persisted in localStorage)
- Modify: `src/components/KitchenDisplay.tsx` (two toggles in the kitchen settings area)

**Interfaces:**
- Produces in `kitchen.ts`: `IDLE_DIM_KEY = "fridgeboard.idle-dim"`, `SLIDESHOW_KEY = "fridgeboard.idle-slideshow"`, `SLIDE_SECONDS = 30`; `parseFlag(raw: string | null, fallback: boolean): boolean`; `nextSlide(index: number, count: number): number` (wraps; 0 when `count <= 1`); `idleDimOpacity(night: boolean): number` returns 0.55 by day and 0.75 at night.
- Hook returns `{ idleDim: boolean, setIdleDim, slideshow: boolean, setSlideshow }`; `idleDim` default true, `slideshow` default false.

- [ ] **Step 1:** Tests: `parseFlag(null,true)` true; `"0"` false; `"1"` true; `nextSlide(2,3)` 0; `nextSlide(0,1)` 0; `nextSlide(0,0)` 0; `idleDimOpacity(true) > idleDimOpacity(false)`.
- [ ] **Step 2:** Run `npx vitest run src/lib/kitchen.test.ts`; expect FAIL.
- [ ] **Step 3:** Implement the functions and the hook state (read localStorage in try/catch, as `KITCHEN_MODE_KEY` does).
- [ ] **Step 4:** Add the two toggles (labels "Dim the screen when idle" and "Photo slideshow when idle") where the kitchen switch lives. Settings stay reachable through the existing press-and-hold path.
- [ ] **Step 5:** `npm test`, `npm run lint`; expect PASS.
- [ ] **Step 6: Commit** `feat(kitchen): idle dim and slideshow settings`.

### Task 7: Dimmed idle view and photo slideshow

**Files:**
- Create: `src/lib/photo-store.ts` (IndexedDB: `listPhotos(): Promise<Blob[]>`, `addPhotos(files: File[]): Promise<void>`, `clearPhotos(): Promise<void>`; all resolve to empty/no-op if IndexedDB is unavailable)
- Create: `src/components/IdleSlideshow.tsx`
- Modify: `src/components/Ambient.tsx` (`AmbientScreen` accepts `dim: boolean` and `slideshow: boolean`), `src/components/HouseholdWorkspace.tsx` (~line 372, pass the Task 6 settings), `src/components/KitchenDisplay.tsx` (photo picker: "Choose photos", count, "Remove all"), `src/app/workspace.css`

**Interfaces:**
- Consumes: `nextSlide`, `SLIDE_SECONDS`, `idleDimOpacity` from Task 6.
- Produces: `IdleSlideshow({ night: boolean, now: Date })` renders object URLs from `listPhotos()`, cross-fades with Framer Motion every `SLIDE_SECONDS`, shows a small clock in a corner, revokes object URLs on unmount, and renders `null` (so the clock view shows) when there are no photos or a photo errors out.

- [ ] **Step 1:** `photo-store.ts` with a single DB `fridgeboard` / store `photos`; downscale each picked image to max 1920px on the longest side (canvas) before storing so a tablet's storage is not filled.
- [ ] **Step 2:** `AmbientScreen`: when `dim`, add a fixed black overlay at `idleDimOpacity(night)` above the content with `pointer-events: none`, so the first tap still wakes the screen. When `slideshow` and photos exist, render `IdleSlideshow` instead of the info layout.
- [ ] **Step 3:** Photo picker UI using `<input type="file" accept="image/*" multiple>`; cap at 30 photos with a plain message beyond that.
- [ ] **Step 4:** `npm run lint`, `npm test`, `npm run build:local`; expect PASS.
- [ ] **Step 5:** Browser check with kitchen mode on and `KITCHEN_IDLE_MS` temporarily shortened locally (do not commit the change): dim visible, slideshow rotates, a tap wakes, zero photos shows the clock view. Report what you saw.
- [ ] **Step 6:** Add short notes on the swipe card, `end_date` and the idle settings to `CLAUDE.md`. Commit `feat(kitchen): dimmed idle screen and photo slideshow`.
