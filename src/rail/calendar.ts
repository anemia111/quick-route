import type { RailPackage } from "./model";
export function runsOn(p: RailPackage, service: string, date: string): boolean {
  const exception = p.exceptions.find(
    (e) => e.service === service && e.date === date,
  );
  if (exception) return exception.added;
  const c = p.calendars.find((c) => c.id === service);
  if (!c || date < c.start || date > c.end) return false;
  const day = new Date(
    `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T12:00:00Z`,
  ).getUTCDay();
  return c.days[day] === 1;
}
