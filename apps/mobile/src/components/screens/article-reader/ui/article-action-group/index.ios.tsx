import { NativeHost } from '@components/ui/native-host';
import { Button, ControlGroup, GlassEffectContainer } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, labelStyle, tint } from '@expo/ui/swift-ui/modifiers';
import { SUPPORTS_GLASS } from '@lib/constants/platform';
import type { ReactNode } from 'react';
import type { ArticleActionGroupProps } from './types';

export type { ArticleActionGroupProps } from './types';

const BOOKMARK_YELLOW = '#FBBC04';

/**
 * The reader's action cluster (share / AI summary / copy link / bookmark) as one SwiftUI
 * `ControlGroup`, so the buttons read as a single unit. On iOS 26 the group sits in a
 * `GlassEffectContainer`, letting the glass buttons blend into one Liquid Glass capsule.
 */
export function ArticleActionGroup({
  colors,
  isDark,
  onShare,
  onBookmark,
  onGenerateSummary,
  onCopyLink,
  isBookmarked,
  isClipped,
  showDone = false,
}: ArticleActionGroupProps) {
  const style = [
    labelStyle('iconOnly'),
    buttonStyle(SUPPORTS_GLASS ? 'glass' : 'bordered'),
    controlSize('regular'),
  ];

  let bookmarkIcon: 'bookmark' | 'bookmark.fill' | 'checkmark.circle.fill' = 'bookmark';
  let bookmarkTint = colors.grey;
  if (showDone) {
    bookmarkIcon = 'checkmark.circle.fill';
    bookmarkTint = colors.secondary;
  } else if (isBookmarked) {
    bookmarkIcon = 'bookmark.fill';
    bookmarkTint = BOOKMARK_YELLOW;
  }

  const group = (
    <ControlGroup>
      <Button
        label="Share"
        systemImage="square.and.arrow.up"
        onPress={onShare}
        modifiers={[...style, tint(colors.grey)]}
      />
      {!isClipped && onGenerateSummary && (
        <Button
          label="AI Summary"
          systemImage="sparkles"
          onPress={onGenerateSummary}
          modifiers={[...style, tint(colors.grey)]}
        />
      )}
      {onCopyLink && (
        <Button
          label="Copy link"
          systemImage="link"
          onPress={onCopyLink}
          modifiers={[...style, tint(colors.grey)]}
        />
      )}
      <Button
        label={showDone ? 'Mark as read' : 'Bookmark'}
        systemImage={bookmarkIcon}
        onPress={onBookmark}
        modifiers={[...style, tint(bookmarkTint)]}
      />
    </ControlGroup>
  );

  const wrapped: ReactNode = SUPPORTS_GLASS ? (
    <GlassEffectContainer spacing={8}>{group}</GlassEffectContainer>
  ) : (
    group
  );

  return <NativeHost isDark={isDark}>{wrapped}</NativeHost>;
}
