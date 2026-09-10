import { Text } from '@components/ui/text';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { type CodexDigestResponse, formatAbsoluteDate } from '@readspace/shared';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DevelopmentCard } from './development-card';
import { WorthReadingStrip } from './worth-reading-strip';

interface CodexViewProps {
  /** A COMPLETED digest with a payload — callers handle the other states. */
  digest: CodexDigestResponse;
}

/**
 * The finished digest: scale-setter, Developments (synthesis + provenance + expandable
 * write-ups), the Worth Reading strip, and a closing line. Finite by construction.
 */
export function CodexView({ digest }: CodexViewProps) {
  const insets = useSafeAreaInsets();
  const { payload } = digest;
  if (!payload) return null;

  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: insets.bottom + BOTTOM_TABBAR_BASE_HEIGHT + 24,
      }}>
      <View className="mb-6">
        <Text
          size="xs"
          fontFamily="geist-semibold"
          className="text-secondary uppercase tracking-wide">
          Daily Digest · {formatAbsoluteDate(digest.digest_date)}
        </Text>
        <Text
          size="lg"
          fontFamily="geist-medium"
          className="text-primary-foreground mt-2 leading-6">
          {payload.headline?.trim() || payload.gist || payload.scale_setter}
        </Text>
        {payload.headline?.trim() &&
          payload.gist?.trim() &&
          payload.gist.trim() !== payload.headline.trim() && (
            <Text size="sm" className="text-grey mt-2 leading-5">
              {payload.gist}
            </Text>
          )}
      </View>

      {payload.developments.length > 0 && (
        <View className="mb-8">
          <Text
            size="xs"
            fontFamily="geist-semibold"
            className="text-grey mb-3 uppercase tracking-wide">
            Developments
          </Text>
          <View className="gap-3">
            {payload.developments.map((d, i) => (
              <DevelopmentCard key={`${d.title}-${i}`} development={d} defaultExpanded={i === 0} />
            ))}
          </View>
        </View>
      )}

      {payload.developments.length === 0 && (
        <Text size="sm" className="text-grey mb-8 leading-5">
          Nothing your sources converged on today — just the standalone reads below.
        </Text>
      )}

      <WorthReadingStrip items={payload.worth_reading} />

      <Text size="xs" className="text-grey mt-8 text-center leading-5">
        {payload.closing_line}
      </Text>
    </ScrollView>
  );
}
