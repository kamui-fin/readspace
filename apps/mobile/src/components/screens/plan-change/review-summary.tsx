import { ChangeValue, type GroupedRow, GroupedRows, PlainValue } from './grouped-rows';

interface ReviewSummaryProps {
  feedCount: number;
  keepCount: number;
  newsletterCount: number;
  savedCount: number;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Final tally shown before the unsubscribe is applied. */
export function ReviewSummary({
  feedCount,
  keepCount,
  newsletterCount,
  savedCount,
}: ReviewSummaryProps) {
  const removed = feedCount - keepCount;
  const rows: GroupedRow[] = [
    {
      key: 'feeds',
      label: 'Feeds',
      detail:
        removed > 0 ? `${plural(removed, 'feed')} will be unsubscribed.` : 'Everything stays.',
      value:
        removed > 0 ? (
          <ChangeValue from={feedCount} to={keepCount} />
        ) : (
          <PlainValue value={keepCount} />
        ),
    },
  ];
  if (newsletterCount > 0) {
    rows.push({
      key: 'newsletters',
      label: 'Newsletters',
      detail: `${plural(newsletterCount, 'newsletter')} will be removed.`,
      value: <ChangeValue from={newsletterCount} to={0} />,
    });
  }
  if (savedCount > 0) {
    rows.push({
      key: 'saved',
      label: 'Saved articles',
      detail: 'Untouched.',
      value: <PlainValue value={savedCount} />,
    });
  }

  return <GroupedRows rows={rows} />;
}
