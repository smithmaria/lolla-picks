export const SLOT_MINUTES = 15

/** Parse "HH:MM" into total minutes since midnight */
export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/**
 * Return [startMinutes, endMinutes] normalized so end > start.
 * Handles artists that span midnight by adding 24h to the end.
 */
export function normalizeSlotMinutes(start: string, end: string): [number, number] {
  const s = toMinutes(start)
  let e = toMinutes(end)
  if (e <= s) e += 24 * 60
  return [s, e]
}

/** Round down to previous hour boundary (in minutes) */
export function floorHour(minutes: number): number {
  return Math.floor(minutes / 60) * 60
}

/** Round up to next hour boundary (in minutes) */
export function ceilHour(minutes: number): number {
  return Math.ceil(minutes / 60) * 60
}

/** Format minutes-since-midnight as "12 PM", "1 PM", etc. */
export function formatHour(minutes: number): string {
  const normalized = minutes % (24 * 60)
  const h = Math.floor(normalized / 60)
  if (h === 0) return '12 AM'
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}
