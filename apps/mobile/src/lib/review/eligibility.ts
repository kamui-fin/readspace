export interface ReviewHistory {
  days: string[];
  articleIds: string[];
  openedDigest: boolean;
  lastRequestedAt: number | null;
  articlesAtLastRequest: number;
}

export const emptyReviewHistory: ReviewHistory = {
  days: [],
  articleIds: [],
  openedDigest: false,
  lastRequestedAt: null,
  articlesAtLastRequest: 0,
};

export function localDay(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function applyReviewActivity(
  history: ReviewHistory,
  date: Date,
  articleId?: string,
  digest = false
): ReviewHistory {
  const next = {
    ...history,
    days: [...history.days],
    articleIds: [...history.articleIds],
  };
  const day = localDay(date);
  if (next.days.length < 3 && !next.days.includes(day)) next.days.push(day);
  if (articleId && !next.articleIds.includes(articleId)) next.articleIds.push(articleId);
  if (digest) next.openedDigest = true;
  return next;
}

export function isReviewEligible(history: ReviewHistory, now: number) {
  const firstRequestEligible =
    (history.days.length >= 2 && history.openedDigest) ||
    (history.days.length >= 3 && history.articleIds.length >= 2);
  if (!firstRequestEligible) return false;
  return (
    history.lastRequestedAt === null ||
    (now - history.lastRequestedAt >= 120 * 24 * 60 * 60 * 1000 &&
      history.articleIds.length >= history.articlesAtLastRequest + 2)
  );
}
