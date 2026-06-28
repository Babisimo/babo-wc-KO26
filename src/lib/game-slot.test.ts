import { describe, it, expect } from 'vitest';
import { gameSlotPick, type SlotParticipants } from './game-slot';

const slots: SlotParticipants[] = [
  { slot: 1, teamA: 'RSA', teamB: 'CAN' },
  { slot: 2, teamA: 'GER', teamB: 'PAR' },
];

describe('gameSlotPick', () => {
  it('matches a fixture to its slot regardless of team order and returns the user pick', () => {
    const r = gameSlotPick(slots, { teamA: 'PAR', teamB: 'GER' }, { 2: 'GER' }, {});
    expect(r).toEqual({ slot: 2, yourPick: 'GER', result: 'pending' });
  });

  it('marks won/busted once the slot has a winner', () => {
    expect(gameSlotPick(slots, { teamA: 'GER', teamB: 'PAR' }, { 2: 'GER' }, { 2: 'GER' }).result).toBe('won');
    expect(gameSlotPick(slots, { teamA: 'GER', teamB: 'PAR' }, { 2: 'PAR' }, { 2: 'GER' }).result).toBe('busted');
  });

  it('returns nulls when the fixture has no slot or the user has no pick there', () => {
    expect(gameSlotPick(slots, { teamA: 'BRA', teamB: 'JPN' }, { 2: 'GER' }, {})).toEqual({ slot: null, yourPick: null, result: null });
    expect(gameSlotPick(slots, { teamA: 'GER', teamB: 'PAR' }, {}, {})).toEqual({ slot: 2, yourPick: null, result: null });
  });
});
