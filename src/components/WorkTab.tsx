"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { motion } from "framer-motion";
import { BriefcaseBusiness, ChevronLeft, ChevronRight, Copy, House, Moon } from "lucide-react";
import { Dialog } from "@/components/Dialog";
import { DataStatus } from "@/components/HomeDashboard";
import { MemberAvatar, useAccountLooks, type MemberLook } from "@/components/MemberTag";
import { useHousehold, useWorkData } from "@/components/WorkspaceData";
import { formatEventTime } from "@/lib/calendar";
import {
  addDays,
  atWorkNow,
  homeSummary,
  isOvernight,
  mondayOf,
  weekOf,
  type HomeSummary,
} from "@/lib/work";
import type { WorkShift } from "@/lib/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayLabel(day: string, options: Intl.DateTimeFormatOptions) {
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, options);
}

function HomeCell({ summary }: { summary: HomeSummary }) {
  if (summary.kind === "all-day") {
    return <span className="work-home is-all-day">All day</span>;
  }
  return (
    <span className="work-home">
      {summary.until && <span>Until {formatEventTime(summary.until)}</span>}
      <span>{summary.from ? `From ${formatEventTime(summary.from)}` : "Late tonight"}</span>
    </span>
  );
}

type Editing = { userId: string; look: MemberLook; day: string; shift: WorkShift | null };

function ShiftEditor({
  editing,
  week,
  onClose,
}: {
  editing: Editing;
  week: string[];
  onClose: () => void;
}) {
  const work = useWorkData();
  const [start, setStart] = useState(editing.shift?.start_time ?? "09:00");
  const [end, setEnd] = useState(editing.shift?.end_time ?? "17:00");
  const [note, setNote] = useState(editing.shift?.note ?? "");
  const [days, setDays] = useState<string[]>([editing.day]);
  const toggleDay = (day: string) =>
    setDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day],
    );

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!start || !end || !days.length) return;
    const saved = await work.saveShifts(
      days.map((day) => ({
        user_id: editing.userId,
        shift_date: day,
        start_time: start,
        end_time: end,
        note: note.trim() || null,
      })),
    );
    if (saved) onClose();
  };
  const dayOff = async () => {
    if (await work.clearShifts(editing.userId, days)) onClose();
  };
  const overnight = Boolean(start && end) && isOvernight({ start_time: start, end_time: end });

  return (
    <Dialog
      title={`${editing.look.short} · ${dayLabel(editing.day, { weekday: "short", day: "numeric", month: "short" })}`}
      onClose={onClose}
    >
      <form className="shift-form" onSubmit={save}>
        <div className="shift-times">
          <label>
            <span>Starts</span>
            <input type="time" required value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            <span>Finishes</span>
            <input type="time" required value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        {overnight && (
          <p className="shift-hint">
            <Moon size={16} aria-hidden /> Finishes the next morning.
          </p>
        )}
        <label className="shift-note">
          <span>Note (optional)</span>
          <input
            type="text"
            maxLength={60}
            placeholder="Office, night shift, on call…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <fieldset className="shift-days">
          <legend>Same hours on</legend>
          <div>
            {week.map((day, index) => (
              <button
                key={day}
                type="button"
                aria-pressed={days.includes(day)}
                onClick={() => toggleDay(day)}
              >
                {WEEKDAYS[index]}
              </button>
            ))}
          </div>
        </fieldset>
        {work.error && (
          <p className="data-status error" role="alert">
            {work.error}
          </p>
        )}
        <div className="shift-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={work.isWorking || !days.length}
            onClick={() => void dayOff()}
          >
            <House size={18} /> {days.length > 1 ? "Days off" : "Day off"}
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={work.isWorking || !start || !end || !days.length}
          >
            Save
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Weekly work roster: each member's start and finish per day, and when the
 * whole household is home. Any member can fill it in (shared tablet).
 */
export function WorkTab({ today }: { today: string }) {
  const { members } = useHousehold();
  const looks = useAccountLooks();
  const work = useWorkData();
  const thisMonday = mondayOf(today);
  const [monday, setMonday] = useState(thisMonday);
  const [editing, setEditing] = useState<Editing | null>(null);
  const week = weekOf(monday);
  const shiftFor = (userId: string, day: string) =>
    work.shifts.find((shift) => shift.user_id === userId && shift.shift_date === day) ?? null;
  const awayNow = atWorkNow(work.shifts, new Date());
  const lastWeek = weekOf(addDays(monday, -7));
  const copyable = work.shifts.filter(
    (shift) =>
      lastWeek.includes(shift.shift_date) &&
      !shiftFor(shift.user_id, addDays(shift.shift_date, 7)),
  );
  const copyLastWeek = () =>
    void work.saveShifts(
      copyable.map((shift) => ({
        user_id: shift.user_id,
        shift_date: addDays(shift.shift_date, 7),
        start_time: shift.start_time,
        end_time: shift.end_time,
        note: shift.note,
      })),
    );
  const weekTitle =
    monday === thisMonday
      ? "This week"
      : monday === addDays(thisMonday, 7)
        ? "Next week"
        : monday === addDays(thisMonday, -7)
          ? "Last week"
          : `Week of ${dayLabel(monday, { day: "numeric", month: "short" })}`;
  const range = `${dayLabel(week[0], { day: "numeric", month: "short" })} – ${dayLabel(week[6], {
    day: "numeric",
    month: "short",
  })}`;

  return (
    <section className="card work-card" aria-label="Work schedule">
      <div className="schedule-head">
        <div className="card-heading">
          <span className="icon-tile">
            <BriefcaseBusiness size={22} />
          </span>
          <div className="heading-text">
            <h2>Work schedule</h2>
            <p>Who&apos;s at work, and when everyone&apos;s home</p>
          </div>
        </div>
        <div className="work-nav">
          <button
            className="icon-button"
            aria-label="Previous week"
            disabled={monday <= addDays(thisMonday, -7)}
            onClick={() => setMonday(addDays(monday, -7))}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            className="work-week"
            onClick={() => setMonday(thisMonday)}
            aria-label={`${weekTitle}, ${range}. Go to this week`}
          >
            <strong>{weekTitle}</strong>
            <small>{range}</small>
          </button>
          <button
            className="icon-button"
            aria-label="Next week"
            onClick={() => setMonday(addDays(monday, 7))}
          >
            <ChevronRight size={20} />
          </button>
          {copyable.length > 0 && (
            <button className="secondary-button" disabled={work.isWorking} onClick={copyLastWeek}>
              <Copy size={18} /> Copy last week
            </button>
          )}
        </div>
      </div>
      <DataStatus loading={false} error={editing ? "" : work.error} connected />

      {members.length === 0 ? (
        <p className="empty-copy">{work.loading ? "Loading…" : "No household members yet."}</p>
      ) : (
        <div
          className="work-grid"
          role="table"
          aria-label={`Work schedule, ${range}`}
          // CSSProperties has no index for custom properties; --members sets the column count.
          style={{ "--members": members.length } as CSSProperties}
        >
          <div className="work-row is-head" role="row">
            <span role="columnheader">Day</span>
            {members.map((member, index) => (
              <span key={member.user_id} role="columnheader" className="work-person">
                <MemberAvatar look={looks[index]} size="sm" />
                {looks[index].short}
                {monday === thisMonday && awayNow.has(member.user_id) && (
                  <span className="pill pill-amber">At work</span>
                )}
              </span>
            ))}
            <span role="columnheader">
              <House size={16} aria-hidden /> All home
            </span>
          </div>
          {week.map((day, dayIndex) => {
            const isToday = day === today;
            return (
              <div key={day} role="row" className={`work-row${isToday ? " is-today" : ""}`}>
                <span role="rowheader" className="work-day">
                  {isToday ? "Today" : WEEKDAYS[dayIndex]}
                  <strong>{new Date(`${day}T12:00:00`).getDate()}</strong>
                </span>
                {members.map((member, index) => {
                  const shift = shiftFor(member.user_id, day);
                  return (
                    <span role="cell" key={member.user_id}>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        className={`work-cell${shift ? " is-working" : ""}`}
                        onClick={() =>
                          setEditing({ userId: member.user_id, look: looks[index], day, shift })
                        }
                        aria-label={`${looks[index].name}, ${dayLabel(day, { weekday: "long" })}: ${
                          shift
                            ? `works ${formatEventTime(shift.start_time)} to ${formatEventTime(shift.end_time)}`
                            : "home, no work"
                        }. Edit`}
                      >
                        <span className="work-cell-who">
                          <MemberAvatar look={looks[index]} size="sm" />
                        </span>
                        {shift ? (
                          <>
                            <span className="work-time">
                              {formatEventTime(shift.start_time)}
                              <span aria-hidden> – </span>
                              {formatEventTime(shift.end_time)}
                              {isOvernight(shift) && <small> +1</small>}
                            </span>
                            {shift.note && <span className="work-note">{shift.note}</span>}
                          </>
                        ) : (
                          <span className="work-off">Off</span>
                        )}
                      </motion.button>
                    </span>
                  );
                })}
                <span role="cell">
                  <HomeCell summary={homeSummary(work.shifts, day)} />
                </span>
              </div>
            );
          })}
        </div>
      )}
      <p className="work-footnote">Tap a day to set hours. Days without hours count as home.</p>
      {editing && <ShiftEditor editing={editing} week={week} onClose={() => setEditing(null)} />}
    </section>
  );
}
