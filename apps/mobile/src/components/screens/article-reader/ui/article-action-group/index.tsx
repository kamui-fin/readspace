import { Sparkle } from '@components/icons/svg';
import { Button } from '@components/ui/button';
import { BAR_ICON_SIZE } from '@lib/constants/app';
import { BookmarkIcon, CheckCircleIcon, CopyIcon, ShareIcon } from '@solar-icons/react-native/bold';
import { View } from 'react-native';
import type { ArticleActionGroupProps } from './types';

export type { ArticleActionGroupProps } from './types';

/** Saved is yellow everywhere in the app — the list swipe uses the same value. */
const BOOKMARK_YELLOW = '#FBBC04';

/**
 * The reader's action cluster on Android (and any non-iOS default): our own Solar icon buttons.
 * iOS never renders this — its bar is a real `UINavigationBar` of SF Symbol buttons.
 *
 * Every glyph is `BAR_ICON_SIZE` inside a 40pt `icon`/`small` button, the same box the back
 * button uses, so the row reads as one set of controls rather than a big chevron beside a
 * handful of smaller icons.
 */
export function ArticleActionGroup({
  colors,
  onShare,
  onBookmark,
  onGenerateSummary,
  onCopyLink,
  isBookmarked,
  isClipped,
  showDone = false,
}: ArticleActionGroupProps) {
  return (
    <View className="flex-row items-center gap-3">
      <Button variant="icon" size="small" fullWidth={false} onPress={onShare}>
        <ShareIcon size={BAR_ICON_SIZE} strokeWidth={2.4} color={colors.grey} />
      </Button>

      {!isClipped && onGenerateSummary && (
        <Button variant="icon" size="small" fullWidth={false} onPress={onGenerateSummary}>
          <Sparkle width={BAR_ICON_SIZE} height={BAR_ICON_SIZE} color={colors.grey} />
        </Button>
      )}

      {onCopyLink && (
        <Button variant="icon" size="small" fullWidth={false} onPress={onCopyLink}>
          <CopyIcon size={BAR_ICON_SIZE} strokeWidth={2.4} color={colors.grey} />
        </Button>
      )}

      <Button
        variant="icon"
        size="small"
        fullWidth={false}
        onPress={onBookmark}
        style={!showDone && isBookmarked ? { backgroundColor: colors.icon_bg_yellow } : undefined}>
        {showDone ? (
          <CheckCircleIcon size={BAR_ICON_SIZE} color={colors.secondary} strokeWidth={2.4} />
        ) : (
          <BookmarkIcon
            size={BAR_ICON_SIZE}
            color={isBookmarked ? BOOKMARK_YELLOW : colors.grey}
            strokeWidth={2.4}
          />
        )}
      </Button>
    </View>
  );
}
