import { describe, expect, it } from 'vitest'
import type { Day } from '../../types'
import {
  CODE_CHARS,
  MAX_VOTES,
  MIN_VOTES,
  clampVotes,
  generateJoinCode,
  isValidJoinCode,
  normalizeJoinCode,
  parseVotesInput,
  toggleDay,
  validateCreateForm,
} from './homeValidation'

describe('normalizeJoinCode', () => {
  it('trims whitespace and uppercases', () => {
    expect(normalizeJoinCode('  camp4t ')).toBe('CAMP4T')
  })

  it('leaves an already-normalized code unchanged', () => {
    expect(normalizeJoinCode('CAMP4T')).toBe('CAMP4T')
  })
})

describe('isValidJoinCode', () => {
  it('accepts exactly 6 uppercase alphanumeric characters', () => {
    expect(isValidJoinCode('CAMP4T')).toBe(true)
    expect(isValidJoinCode('ABC123')).toBe(true)
  })

  it('rejects wrong length', () => {
    expect(isValidJoinCode('CAMP4')).toBe(false)
    expect(isValidJoinCode('CAMP4TX')).toBe(false)
    expect(isValidJoinCode('')).toBe(false)
  })

  it('rejects lowercase and non-alphanumeric characters', () => {
    expect(isValidJoinCode('camp4t')).toBe(false)
    expect(isValidJoinCode('CAMP-4')).toBe(false)
    expect(isValidJoinCode('CAMP 4')).toBe(false)
  })
})

describe('validateCreateForm', () => {
  const valid = { name: 'Maria', password: 'hunter2', days: ['friday'] as Day[] }

  it('returns no errors for a valid form', () => {
    expect(validateCreateForm(valid)).toEqual({})
  })

  it('requires a non-blank name', () => {
    expect(validateCreateForm({ ...valid, name: '   ' }).name).toBe('Your name is required.')
  })

  it('requires a password', () => {
    expect(validateCreateForm({ ...valid, password: '' }).password).toBe('A password is required.')
  })

  it('rejects a password containing spaces', () => {
    expect(validateCreateForm({ ...valid, password: 'hunter 2' }).password).toBe(
      'Password cannot contain spaces.',
    )
  })

  it('requires at least one day', () => {
    expect(validateCreateForm({ ...valid, days: [] }).days).toBe('Select at least one day.')
  })

  it('reports multiple errors at once', () => {
    const errors = validateCreateForm({ name: '', password: '', days: [] })
    expect(errors).toEqual({
      name: 'Your name is required.',
      password: 'A password is required.',
      days: 'Select at least one day.',
    })
  })
})

describe('clampVotes', () => {
  it('passes through values inside the range', () => {
    expect(clampVotes(25)).toBe(25)
  })

  it('clamps to the minimum and maximum', () => {
    expect(clampVotes(0)).toBe(MIN_VOTES)
    expect(clampVotes(-10)).toBe(MIN_VOTES)
    expect(clampVotes(999)).toBe(MAX_VOTES)
  })
})

describe('parseVotesInput', () => {
  it('parses and clamps numeric text', () => {
    expect(parseVotesInput('30')).toBe(30)
    expect(parseVotesInput('500')).toBe(MAX_VOTES)
  })

  it('falls back to the minimum for empty or non-numeric input', () => {
    expect(parseVotesInput('')).toBe(MIN_VOTES)
    expect(parseVotesInput('abc')).toBe(MIN_VOTES)
  })
})

describe('toggleDay', () => {
  it('adds a day that is not selected', () => {
    expect(toggleDay(['friday'], 'saturday')).toEqual(['friday', 'saturday'])
  })

  it('removes a day that is already selected', () => {
    expect(toggleDay(['friday', 'saturday'], 'friday')).toEqual(['saturday'])
  })

  it('keeps the result in festival order regardless of insertion order', () => {
    expect(toggleDay(['sunday', 'thursday'], 'friday')).toEqual([
      'thursday',
      'friday',
      'sunday',
    ])
  })
})

describe('generateJoinCode', () => {
  it('produces a 6-character code using only the unambiguous char set', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJoinCode()
      expect(code).toHaveLength(6)
      expect([...code].every(c => CODE_CHARS.includes(c))).toBe(true)
      expect(isValidJoinCode(code)).toBe(true)
    }
  })
})
