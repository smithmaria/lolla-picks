import type { Day } from '../../types'

export const JOIN_CODE_RE = /^[A-Z0-9]{6}$/

// Unambiguous chars (no 0/O, 1/I/L)
export const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export const ALL_DAYS: { value: Day; label: string }[] = [
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
]

export const MIN_VOTES = 1
export const MAX_VOTES = 160

/** Normalize raw join-code input the way the join form does before validating. */
export function normalizeJoinCode(raw: string): string {
  return raw.trim().toUpperCase()
}

/** True when a (normalized) code matches the 6-character alphanumeric format. */
export function isValidJoinCode(code: string): boolean {
  return JOIN_CODE_RE.test(code)
}

export interface CreateFormValues {
  name: string
  password: string
  days: Day[]
}

export interface CreateFormErrors {
  name?: string
  password?: string
  days?: string
}

/**
 * Validate the create-room form. Returns an errors object;
 * an empty object means the form is valid.
 */
export function validateCreateForm(values: CreateFormValues): CreateFormErrors {
  const errors: CreateFormErrors = {}
  if (!values.name.trim()) errors.name = 'Your name is required.'
  if (!values.password) errors.password = 'A password is required.'
  else if (/\s/.test(values.password)) errors.password = 'Password cannot contain spaces.'
  if (values.days.length === 0) errors.days = 'Select at least one day.'
  return errors
}

/** Clamp a votes-per-user value into the allowed [MIN_VOTES, MAX_VOTES] range. */
export function clampVotes(value: number): number {
  return Math.min(MAX_VOTES, Math.max(MIN_VOTES, value))
}

/** Parse raw text from the votes field and clamp it (empty/NaN falls back to MIN). */
export function parseVotesInput(raw: string): number {
  return clampVotes(parseInt(raw) || MIN_VOTES)
}

/** Toggle a day on/off, keeping the result sorted in festival order. */
export function toggleDay(days: Day[], day: Day): Day[] {
  const order = ALL_DAYS.map(d => d.value)
  const next = days.includes(day) ? days.filter(d => d !== day) : [...days, day]
  return next.sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

/** Generate a random 6-character join code using only the unambiguous char set. */
export function generateJoinCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(b => CODE_CHARS[b % CODE_CHARS.length])
    .join('')
}
