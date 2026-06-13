import { describe, expect, it } from 'vitest'
import {
  SLOT_MINUTES,
  ceilHour,
  floorHour,
  formatHour,
  normalizeSlotMinutes,
  toMinutes,
} from './scheduleTime'

describe('toMinutes', () => {
  it('converts "HH:MM" to minutes since midnight', () => {
    expect(toMinutes('00:00')).toBe(0)
    expect(toMinutes('01:00')).toBe(60)
    expect(toMinutes('12:30')).toBe(750)
    expect(toMinutes('23:59')).toBe(1439)
  })

  it('treats missing parts as 0', () => {
    expect(toMinutes('')).toBe(0)
    expect(toMinutes('5')).toBe(300) // "5" -> 5 hours, no minutes
  })
})

describe('normalizeSlotMinutes', () => {
  it('returns [start, end] when end is after start on the same day', () => {
    expect(normalizeSlotMinutes('12:00', '13:30')).toEqual([720, 810])
  })

  it('adds 24h to an end that spans midnight', () => {
    // starts 23:30, ends 00:30 the next day
    expect(normalizeSlotMinutes('23:30', '00:30')).toEqual([1410, 1470])
  })

  it('adds 24h when end equals start (treats as a full wrap, never zero-length)', () => {
    expect(normalizeSlotMinutes('22:00', '22:00')).toEqual([1320, 1320 + 24 * 60])
  })

  it('always yields end strictly greater than start', () => {
    const [s, e] = normalizeSlotMinutes('23:45', '00:15')
    expect(e).toBeGreaterThan(s)
  })
})

describe('floorHour', () => {
  it('rounds down to the previous hour boundary', () => {
    expect(floorHour(0)).toBe(0)
    expect(floorHour(59)).toBe(0)
    expect(floorHour(60)).toBe(60)
    expect(floorHour(125)).toBe(120)
  })
})

describe('ceilHour', () => {
  it('rounds up to the next hour boundary', () => {
    expect(ceilHour(0)).toBe(0)
    expect(ceilHour(1)).toBe(60)
    expect(ceilHour(60)).toBe(60)
    expect(ceilHour(61)).toBe(120)
  })
})

describe('formatHour', () => {
  it('formats midnight and noon as 12-hour labels', () => {
    expect(formatHour(0)).toBe('12 AM')
    expect(formatHour(12 * 60)).toBe('12 PM')
  })

  it('formats AM and PM hours', () => {
    expect(formatHour(60)).toBe('1 AM')
    expect(formatHour(11 * 60)).toBe('11 AM')
    expect(formatHour(13 * 60)).toBe('1 PM')
    expect(formatHour(23 * 60)).toBe('11 PM')
  })

  it('wraps hours past 24h back into the same day (midnight-spanning slots)', () => {
    expect(formatHour(25 * 60)).toBe('1 AM') // 24h + 1h
    expect(formatHour(24 * 60)).toBe('12 AM')
  })

  it('ignores the minutes within an hour', () => {
    expect(formatHour(13 * 60 + 45)).toBe('1 PM')
  })
})

describe('SLOT_MINUTES', () => {
  it('is the 15-minute grid resolution', () => {
    expect(SLOT_MINUTES).toBe(15)
  })
})
