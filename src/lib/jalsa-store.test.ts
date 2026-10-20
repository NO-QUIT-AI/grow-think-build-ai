/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { mergeJalsaMessages, validJalsaText, type JalsaMessage } from './jalsa-store';
const queued: JalsaMessage = { id: 'a', peer_id: 'b', sender_id: 'c', text: 'hello', delivery: 'queued', created_at: '2026-10-20T04:00:00Z' };
describe('Jalsa offline queue', () => {
  test('merges offline and online messages without duplicating a message', () => {
    expect(mergeJalsaMessages([queued], [{ ...queued, delivery: 'sent' }])).toEqual([{ ...queued, delivery: 'sent' }]);
  });
  test('does not revert an acknowledged offline message to queued during sync', () => {
    expect(mergeJalsaMessages([{ ...queued, delivery: 'sent' }], [queued])[0]?.delivery).toBe('sent');
  });
  test('rejects blank messages and messages over the transport limit', () => {
    expect(validJalsaText(' ')).toBe(false);
    expect(validJalsaText('a'.repeat(1000))).toBe(true);
    expect(validJalsaText('a'.repeat(1001))).toBe(false);
  });
});