// Working-hours helpers over the 2gis schedule shape:
//   { Mon: { working_hours: [{ from: "09:00", to: "19:00" }] }, ..., is_24x7?: bool }
// «работает сейчас» is computed against Astana time (UTC+5, no DST).

export type DaySchedule = { working_hours?: { from: string; to: string }[] };
export type Schedule = Record<string, DaySchedule | boolean | unknown> & { is_24x7?: boolean };

const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hm(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}

function astanaNow(): { dayKey: string; minutes: number } {
  const a = new Date(Date.now() + 5 * 3600 * 1000); // shift UTC -> Astana
  return { dayKey: DAY_KEYS[a.getUTCDay()], minutes: a.getUTCHours() * 60 + a.getUTCMinutes() };
}

function dayBlock(schedule: Schedule | null | undefined, dayKey: string): DaySchedule | null {
  if (!schedule) return null;
  const d = (schedule[dayKey] ?? (schedule as Record<string, unknown>)["Everyday"]) as DaySchedule | undefined;
  return d && Array.isArray(d.working_hours) ? d : null;
}

export function isOpenNow(schedule: Schedule | null | undefined): boolean {
  if (!schedule) return false;
  if (schedule.is_24x7) return true;
  const { dayKey, minutes } = astanaNow();
  const d = dayBlock(schedule, dayKey);
  if (!d?.working_hours?.length) return false;
  return d.working_hours.some((w) => {
    const f = hm(w.from), t = hm(w.to);
    return t > f ? minutes >= f && minutes < t : minutes >= f || minutes < t; // handle overnight
  });
}

/** Today's hours as "09:00–19:00" (Astana day), or null if closed/unknown. */
export function todayHours(schedule: Schedule | null | undefined): string | null {
  if (!schedule) return null;
  if (schedule.is_24x7) return "круглосуточно";
  const { dayKey } = astanaNow();
  const d = dayBlock(schedule, dayKey);
  if (!d?.working_hours?.length) return null;
  return d.working_hours.map((w) => `${w.from}–${w.to}`).join(", ");
}

export function hasSchedule(schedule: Schedule | null | undefined): boolean {
  return !!schedule && (schedule.is_24x7 === true || DAY_KEYS.some((k) => dayBlock(schedule, k) !== null));
}
