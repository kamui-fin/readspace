import { Sparkle } from '@components/icons/svg';
import { Button } from '@components/ui/button';
import { BookmarkIcon, CheckCircleIcon, CopyIcon, ShareIcon } from '@solar-icons/react-native/bold';
import { View } from 'react-native';
import type { ArticleActionGroupProps } from './types';

export type { ArticleActionGroupProps } from './types';

/** Android / default: our own icon buttons. iOS uses a native SwiftUI `ControlGroup`. */
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
        <ShareIcon size={18} strokeWidth={2.4} color={colors.grey} />
      </Button>

      {!isClipped && onGenerateSummary && (
        <Button variant="icon" size="small" fullWidth={false} onPress={onGenerateSummary}>
          <Sparkle width={18} height={18} color={colors.grey} />
        </Button>
      )}

      {onCopyLink && (
        <Button variant="icon" size="small" fullWidth={false} onPress={onCopyLink}>
          <CopyIcon size={18} strokeWidth={2.4} color={colors.grey} />
        </Button>
      )}

      <Button
        variant="icon"
        size="small"
        fullWidth={false}
        onPress={onBookmark}
        style={!showDone && isBookmarked ? { backgroundColor: colors.icon_bg_yellow } : undefined}>
        {showDone ? (
          <CheckCircleIcon size={18} color={colors.secondary} strokeWidth={2.4} />
        ) : (
          <BookmarkIcon
            size={18}
            color={isBookmarked ? '#FBBC04' : colors.grey}
            strokeWidth={2.4}
          />
        )}
      </Button>
    </View>
  );
}
