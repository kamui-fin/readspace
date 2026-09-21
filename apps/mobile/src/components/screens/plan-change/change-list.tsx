import { ChangeValue, type GroupedRow, GroupedRows, PlainValue } from './grouped-rows';

interface ChangeListProps {
  feedCount: number;
  feedLimit: number;
  newsletterCount: number;
  savedCount: number;
  savedLimit: number;
}

/** What the Free plan changes for this user, derived from what they currently hold. */
export function ChangeList({
  feedCount,
  feedLimit,
  newsletterCount,
  savedCount,
  savedLimit,
}: ChangeListProps) {
  const overFeeds = feedCount > feedLimit;
  const rows: GroupedRow[] = [
    {
      key: 'feeds',
      label: 'Feeds',
      detail: overFeeds
        ? `You'll pick the ${feedLimit} to keep.`
        : 'All of them fit. Nothing to choose.',
      value: overFeeds ? (
        <ChangeValue from={feedCount} to={feedLimit} />
      ) : (
        <PlainValue value={feedCount} />
      ),
    },
  ];
  if (newsletterCount > 0) {
    rows.push({
      key: 'newsletters',
      label: 'Newsletters',
      detail: 'Pro only. Your inbox address stays reserved.',
      value: <ChangeValue from={newsletterCount} to={0} />,
    });
  }
  if (savedCount > 0) {
    rows.push({
      key: 'saved',
      label: 'Saved articles',
      detail:
        savedCount > savedLimit
          ? `All kept. New saves pause until you're under ${savedLimit}.`
          : 'All kept.',
      value: <PlainValue value={savedCount} />,
    });
  }

  return <GroupedRows rows={rows} />;
}
