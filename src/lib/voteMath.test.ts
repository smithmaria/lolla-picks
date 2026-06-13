import { describe, expect, it } from 'vitest'
import type { RoomSettings } from '../types'
import {
  isOverLimit,
  votesRemaining,
  votesUsed,
  type LineupEntry,
  type VotesByArtist,
} from './voteMath'

const LINEUP: LineupEntry[] = [
  { id: 'thu-1', day: 'thursday' },
  { id: 'thu-2', day: 'thursday' },
  { id: 'fri-1', day: 'friday' },
  { id: 'sat-1', day: 'saturday' },
]

function settings(overrides: Partial<RoomSettings> = {}): RoomSettings {
  return {
    days: ['thursday', 'friday', 'saturday', 'sunday'],
    votes_per_user: 5,
    vote_scope: 'overall',
    ...overrides,
  }
}

describe('votesUsed — overall scope', () => {
  const s = settings({ vote_scope: 'overall' })

  it('sums every vote across all artists', () => {
    const votes: VotesByArtist = { 'thu-1': 2, 'fri-1': 1, 'sat-1': 3 }
    expect(votesUsed(votes, s, LINEUP)).toBe(6)
  })

  it('returns 0 when no votes are cast', () => {
    expect(votesUsed({}, s, LINEUP)).toBe(0)
  })

  it('ignores the day argument in overall scope', () => {
    const votes: VotesByArtist = { 'thu-1': 2, 'fri-1': 1 }
    expect(votesUsed(votes, s, LINEUP, 'thursday')).toBe(3)
  })
})

describe('votesUsed — per_day scope', () => {
  const s = settings({ vote_scope: 'per_day' })

  it('sums only votes for artists playing on the given day', () => {
    const votes: VotesByArtist = { 'thu-1': 2, 'thu-2': 1, 'fri-1': 4 }
    expect(votesUsed(votes, s, LINEUP, 'thursday')).toBe(3)
    expect(votesUsed(votes, s, LINEUP, 'friday')).toBe(4)
  })

  it('returns 0 for a day with no votes', () => {
    const votes: VotesByArtist = { 'thu-1': 2 }
    expect(votesUsed(votes, s, LINEUP, 'saturday')).toBe(0)
  })

  it('returns 0 when no day is provided (per-day total is undefined without one)', () => {
    const votes: VotesByArtist = { 'thu-1': 2, 'fri-1': 1 }
    expect(votesUsed(votes, s, LINEUP)).toBe(0)
  })

  it('ignores votes for artist ids not in the lineup', () => {
    const votes: VotesByArtist = { 'thu-1': 2, 'ghost-99': 5 }
    expect(votesUsed(votes, s, LINEUP, 'thursday')).toBe(2)
  })
})

describe('votesRemaining', () => {
  it('subtracts used votes from the per-user limit', () => {
    const s = settings({ votes_per_user: 5, vote_scope: 'overall' })
    expect(votesRemaining({ 'thu-1': 2 }, s, LINEUP)).toBe(3)
  })

  it('never goes negative when the user is over the limit', () => {
    const s = settings({ votes_per_user: 2, vote_scope: 'overall' })
    expect(votesRemaining({ 'thu-1': 5 }, s, LINEUP)).toBe(0)
  })

  it('counts per-day when scope is per_day', () => {
    const s = settings({ votes_per_user: 3, vote_scope: 'per_day' })
    const votes: VotesByArtist = { 'thu-1': 1, 'fri-1': 3 }
    expect(votesRemaining(votes, s, LINEUP, 'thursday')).toBe(2)
    expect(votesRemaining(votes, s, LINEUP, 'friday')).toBe(0)
  })
})

describe('isOverLimit', () => {
  it('is false at exactly the limit', () => {
    const s = settings({ votes_per_user: 3, vote_scope: 'overall' })
    expect(isOverLimit({ 'thu-1': 3 }, s, LINEUP)).toBe(false)
  })

  it('is true above the limit', () => {
    const s = settings({ votes_per_user: 3, vote_scope: 'overall' })
    expect(isOverLimit({ 'thu-1': 4 }, s, LINEUP)).toBe(true)
  })

  it('evaluates the limit per day in per_day scope', () => {
    const s = settings({ votes_per_user: 2, vote_scope: 'per_day' })
    const votes: VotesByArtist = { 'thu-1': 1, 'thu-2': 2 } // 3 on thursday
    expect(isOverLimit(votes, s, LINEUP, 'thursday')).toBe(true)
    expect(isOverLimit(votes, s, LINEUP, 'friday')).toBe(false)
  })
})
