import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
const expect = (value) => ({ toBe: (expected) => assert.equal(value, expected) });
import {
  applyReviewActivity,
  emptyReviewHistory,
  isReviewEligible,
  localDay,
} from './eligibility.ts';

const now = new Date(2026, 8, 19).getTime();
describe('local review eligibility', () => {
  test('digest path needs two days, and remembers an earlier digest', () => {
    expect(isReviewEligible({ ...emptyReviewHistory, days: ['a'], openedDigest: true }, now)).toBe(
      false
    );
    expect(
      isReviewEligible({ ...emptyReviewHistory, days: ['a', 'b'], openedDigest: true }, now)
    ).toBe(true);
    expect(isReviewEligible({ ...emptyReviewHistory, days: ['a', 'b'] }, now)).toBe(false);
  });
  test('article path needs three days and two articles', () => {
    expect(
      isReviewEligible({ ...emptyReviewHistory, days: ['a', 'b'], articleIds: ['1', '2'] }, now)
    ).toBe(false);
    expect(
      isReviewEligible({ ...emptyReviewHistory, days: ['a', 'b', 'c'], articleIds: ['1'] }, now)
    ).toBe(false);
    expect(
      isReviewEligible(
        { ...emptyReviewHistory, days: ['a', 'b', 'c'], articleIds: ['1', '2'] },
        now
      )
    ).toBe(true);
  });
  test('repeat requests need both 120 days and two additional articles', () => {
    const history = {
      ...emptyReviewHistory,
      days: ['a', 'b'],
      openedDigest: true,
      articleIds: ['1', '2', '3'],
      articlesAtLastRequest: 1,
      lastRequestedAt: now - 120 * 24 * 60 * 60 * 1000,
    };
    expect(isReviewEligible(history, now)).toBe(true);
    expect(isReviewEligible(history, now - 1)).toBe(false);
    expect(isReviewEligible({ ...history, articleIds: ['1', '2'] }, now)).toBe(false);
  });
  test('calendar days use device local time', () => {
    expect(localDay(new Date(2026, 8, 19, 23, 59))).toBe('2026-9-19');
    expect(localDay(new Date(2026, 8, 20, 0, 1))).toBe('2026-9-20');
  });
  test('activity counts distinct days and articles only', () => {
    const dayOne = new Date(2026, 8, 19, 9);
    let history = applyReviewActivity(emptyReviewHistory, dayOne, 'article-1');
    history = applyReviewActivity(history, new Date(2026, 8, 19, 21), 'article-1');
    history = applyReviewActivity(history, new Date(2026, 8, 20, 9), 'article-2', true);
    assert.deepEqual(history.days, ['2026-9-19', '2026-9-20']);
    assert.deepEqual(history.articleIds, ['article-1', 'article-2']);
    assert.equal(history.openedDigest, true);
  });
  test('a third day is retained, but later days do not create eligibility', () => {
    let history = emptyReviewHistory;
    history = applyReviewActivity(history, new Date(2026, 8, 1));
    history = applyReviewActivity(history, new Date(2026, 8, 2));
    history = applyReviewActivity(history, new Date(2026, 8, 3));
    history = applyReviewActivity(history, new Date(2026, 8, 4));
    assert.deepEqual(history.days, ['2026-9-1', '2026-9-2', '2026-9-3']);
  });
});
