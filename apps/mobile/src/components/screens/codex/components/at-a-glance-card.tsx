import { Divider } from '@components/ui/divider';
import { Text } from '@components/ui/text';
import type { CodexDigestResponse } from '@readspace/shared';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { RailCard } from './codex-rail-card';

interface AtAGlanceCardProps {
  digest: CodexDigestResponse;
  style?: StyleProp<ViewStyle>;
}

interface Row {
  label: string;
  value: string;
}

/**
 * The issue colophon — the day's magnitude as a newspaper ledger, not a stat dashboard: label
 * left, mono figure right, hairline rules between. Counts come from the digest row
 * (authoritative). Developments is the count actually shown below — not the pipeline's raw
 * "clusters found" (which can be higher and needs context a one-line stat can't give). Falls
 * back to parsing `scale_setter` only for digests generated before row-level counts existed.
 */
export function AtAGlanceCard({ digest, style }: AtAGlanceCardProps) {
  const shown = digest.payload?.developments.length ?? 0;

  const rows: Row[] = [];
  if (digest.input_article_count != null) {
    rows.push({ label: 'Pieces', value: digest.input_article_count.toLocaleString() });
  }
  if (digest.input_source_count != null) {
    rows.push({ label: 'Sources', value: digest.input_source_count.toLocaleString() });
  }
  rows.push({ label: 'Developments', value: String(shown) });

  const finalRows =
    rows.length >= 3 ? rows : (parseScaleSetter(digest.payload?.scale_setter) ?? rows);
  if (finalRows.length === 0) return null;

  return (
    <RailCard title="This issue" style={style}>
      {finalRows.map((r, i) => (
        <View key={r.label}>
          {i > 0 && <Divider />}
          <View className="flex-row items-baseline justify-between py-2">
            <Text size="sm" className="text-grey">
              {r.label}
            </Text>
            <Text size="sm" fontFamily="mono-medium" className="text-primary-foreground">
              {r.value}
            </Text>
          </View>
        </View>
      ))}
    </RailCard>
  );
}

/** Salvage rows from `scale_setter` (e.g. "143 pieces · 31 sources · 7 developments") for
 *  older digests that predate row-level counts. */
function parseScaleSetter(scaleSetter?: string): Row[] | null {
  if (!scaleSetter) return null;
  const parsed: Row[] = [];
  for (const part of scaleSetter.split('·')) {
    const match = part.trim().match(/^([\d,]+)\s+(.+)$/);
    if (!match) continue;
    const [, value, label] = match;
    if (!value || !label) continue;
    parsed.push({ label: label.replace(/^\w/, (c) => c.toUpperCase()), value });
  }
  return parsed.length >= 2 ? parsed : null;
}
