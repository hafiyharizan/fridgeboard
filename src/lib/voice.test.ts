import { describe, expect, it } from "vitest";
import { describeDate, parseVoiceCommand, splitItems } from "./voice";

// Friday 6 November 2026, 10:00 local.
const now = new Date(2026, 10, 6, 10, 0);
const parse = (text: string) => parseVoiceCommand(text, now);

describe("groceries", () => {
  it("reads an explicit list", () => {
    const result = parse("Add milk, eggs and bread to the shopping list");
    expect(result.kind).toBe("grocery");
    expect(result.items).toEqual(["Milk", "Eggs", "Bread"]);
  });

  it("understands buying and running out", () => {
    expect(parse("We need to buy bananas and some yogurt").items).toEqual(["Bananas", "Yogurt"]);
    expect(parse("we're out of toilet paper").kind).toBe("grocery");
    expect(parse("Buy flowers").kind).toBe("grocery");
    expect(parse("put rice on the grocery list").items).toEqual(["Rice"]);
  });

  it("treats a bare list of known groceries as groceries", () => {
    const result = parse("milk and eggs");
    expect(result.kind).toBe("grocery");
    expect(result.items).toEqual(["Milk", "Eggs"]);
  });
});

describe("to-dos", () => {
  it("reads chores without a time", () => {
    expect(parse("I need to fix the gate")).toMatchObject({ kind: "todo", title: "Fix the gate" });
    expect(parse("Add call the plumber to the to-do list")).toMatchObject({
      kind: "todo",
      title: "Call the plumber",
    });
    expect(parse("Water the plants")).toMatchObject({ kind: "todo", title: "Water the plants" });
  });

  it("becomes a reminder once a day or time is said", () => {
    expect(parse("I need to call the bank tomorrow")).toMatchObject({
      kind: "reminder",
      title: "Call the bank",
      date: "2026-11-07",
    });
  });
});

describe("reminders", () => {
  it("reads 'remind me to'", () => {
    expect(parse("Remind me to call Mum tomorrow at 5 p.m.")).toMatchObject({
      kind: "reminder",
      title: "Call Mum",
      date: "2026-11-07",
      time: "17:00",
    });
  });

  it("moves a time that has passed today to tomorrow", () => {
    expect(parse("remind me to take the bins out at 8 am")).toMatchObject({
      date: "2026-11-07",
      time: "08:00",
    });
    expect(parse("remind me to take the bins out tonight")).toMatchObject({
      date: "2026-11-06",
      time: "19:00",
    });
  });

  it("defaults to today without a day", () => {
    expect(parse("set a reminder to defrost the chicken")).toMatchObject({
      kind: "reminder",
      title: "Defrost the chicken",
      date: "2026-11-06",
      time: null,
    });
  });
});

describe("events", () => {
  it("reads a day and a bare hour", () => {
    // Said on a Friday, "Friday" means next week's.
    expect(parse("Dentist on Friday at 3")).toMatchObject({
      kind: "event",
      title: "Dentist",
      date: "2026-11-13",
      time: "15:00",
    });
    expect(parse("Soccer this Saturday at 9:30am")).toMatchObject({
      kind: "event",
      title: "Soccer",
      date: "2026-11-07",
      time: "09:30",
    });
  });

  it("reads month dates and rolls into next year", () => {
    expect(parse("Add Aisyah's birthday party on the 12th of December")).toMatchObject({
      kind: "event",
      title: "Aisyah's birthday party",
      date: "2026-12-12",
    });
    expect(parse("Car rego due March 3rd")).toMatchObject({ date: "2027-03-03" });
  });

  it("reads relative days, word times and recurrence", () => {
    expect(parse("parent teacher meeting in 3 days at half past four")).toMatchObject({
      date: "2026-11-09",
      time: "16:30",
    });
    expect(parse("Swimming lessons every Tuesday at four pm")).toMatchObject({
      kind: "event",
      title: "Swimming lessons",
      date: "2026-11-10",
      time: "16:00",
      recurrence: "weekly",
    });
    expect(parse("put dinner with the Tans on the calendar next week")).toMatchObject({
      kind: "event",
      title: "Dinner with the Tans",
      date: "2026-11-13",
    });
    expect(parse("We have a doctor's appointment tomorrow morning")).toMatchObject({
      kind: "event",
      title: "Doctor's appointment",
      date: "2026-11-07",
      time: "09:00",
    });
  });
});

describe("helpers", () => {
  it("splits and tidies items", () => {
    expect(splitItems("apples, apples & a few lemons plus cheese")).toEqual([
      "Apples",
      "Lemons",
      "Cheese",
    ]);
  });

  it("describes dates", () => {
    expect(describeDate("2026-11-06", now)).toBe("Today");
    expect(describeDate("2026-11-07", now)).toBe("Tomorrow");
  });
});
