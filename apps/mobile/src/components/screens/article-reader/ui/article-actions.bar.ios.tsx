import { NativeHost } from '@components/ui/native-host';
import { Button, HStack } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  imageScale,
  labelStyle,
  padding,
  rotationEffect,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { Stack } from 'expo-router';
import { useCallback } from 'react';
import type { ArticleActionBarProps } from './article-actions.bar.types';

export type { ArticleActionBarProps } from './article-actions.bar.types';

const BOOKMARK_YELLOW = '#FBBC04';

/** Height of the SwiftUI host in the bar — one navigation-bar row. */
const BAR_HEIGHT = 44;

/**
 * The SwiftUI host is laid out by the navigation bar, not by us, and it sits hard against the
 * trailing edge — a glyph touching the bezel. This is the gutter the bar's own controls would
 * have had.
 */
const BAR_EDGE_INSET = 8;

/**
 * Bar buttons are bare glyphs: `plain` drops the capsule UIKit would otherwise draw around a
 * bordered button, which reads as a foreign widget inside a navigation bar. `imageScale('large')`
 * is what makes them weigh the same as the system back chevron — at the default scale SF Symbols
 * in a custom `headerRight` render noticeably smaller than the bar's own controls, which is
 * exactly the "tiny icons next to a big back button" mismatch.
 *
 * Module scope so the array identity is stable and `headerRight` isn't rebuilt on every render.
 */
const BAR_GLYPH = [labelStyle('iconOnly'), buttonStyle('plain'), imageScale('large')];

/**
 * SF Symbols has no vertical ellipsis (only `ellipsis`, `ellipsis.circle` and the bubble
 * variants), so the vertical overflow dots are the horizontal symbol turned a quarter turn. The
 * button is a square glyph, so rotating it moves the dots without skewing the hit area.
 */
const OVERFLOW_GLYPH = [...BAR_GLYPH, rotationEffect(90)];

/**
 * iOS reader chrome: the screen's real `UINavigationBar`, the way Podcasts and News do it.
 *
 * This renders no RN view at all — it configures the surrounding stack screen, so the bar is a
 * genuine navigation bar with the system back chevron, interactive edge-swipe-to-go-back, and
 * a translucent material that the article scrolls under.
 *
 * `headerTransparent` is what makes tap-to-toggle still work: the bar floats over the content
 * rather than taking layout from it, so showing and hiding it doesn't reflow the article or
 * move the reader's place on the page.
 *
 * The overflow button opens the options sheet rather than a popover — Mail's pattern, and the
 * reason everything that doesn't fit in the bar has exactly one home.
 */
export function ArticleActionBar({
  visible = true,
  onShare,
  onBookmark,
  onMenuPress,
  hideMenu = false,
  onGenerateSummary,
  onCopyLink,
  isBookmarked,
  isClipped,
  showDone = false,
  colors,
}: ArticleActionBarProps) {
  const isDark = useIsDarkMode();

  let bookmarkIcon: 'bookmark' | 'bookmark.fill' | 'checkmark.circle.fill' = 'bookmark';
  let bookmarkTint = colors.grey;
  if (showDone) {
    bookmarkIcon = 'checkmark.circle.fill';
    bookmarkTint = colors.secondary;
  } else if (isBookmarked) {
    bookmarkIcon = 'bookmark.fill';
    bookmarkTint = BOOKMARK_YELLOW;
  }

  const headerRight = useCallback(
    () => (
      <NativeHost isDark={isDark} style={{ height: BAR_HEIGHT }}>
        <HStack spacing={20} modifiers={[padding({ trailing: BAR_EDGE_INSET })]}>
          <Button
            label="Share"
            systemImage="square.and.arrow.up"
            onPress={onShare}
            modifiers={[...BAR_GLYPH, tint(colors.grey)]}
          />
          {!isClipped && onGenerateSummary && (
            <Button
              label="AI Summary"
              systemImage="sparkles"
              onPress={onGenerateSummary}
              modifiers={[...BAR_GLYPH, tint(colors.grey)]}
            />
          )}
          {onCopyLink && (
            <Button
              label="Copy link"
              systemImage="link"
              onPress={onCopyLink}
              modifiers={[...BAR_GLYPH, tint(colors.grey)]}
            />
          )}
          <Button
            label={showDone ? 'Mark as read' : 'Bookmark'}
            systemImage={bookmarkIcon}
            onPress={onBookmark}
            modifiers={[...BAR_GLYPH, tint(bookmarkTint)]}
          />
          {!hideMenu && (
            <Button
              label="More options"
              systemImage="ellipsis"
              onPress={onMenuPress}
              modifiers={[...OVERFLOW_GLYPH, tint(colors.grey)]}
            />
          )}
        </HStack>
      </NativeHost>
    ),
    [
      onShare,
      onGenerateSummary,
      onCopyLink,
      onBookmark,
      onMenuPress,
      hideMenu,
      isClipped,
      showDone,
      bookmarkIcon,
      bookmarkTint,
      colors.grey,
      isDark,
    ]
  );

  return (
    <Stack.Screen
      options={{
        headerShown: visible,
        title: '',
        headerTransparent: true,
        headerShadowVisible: false,
        // Never fall back to the previous route's title: expo-router defaults that to the route
        // name, so backing out of an article offered a chevron labelled "(tabs)".
        headerBackButtonDisplayMode: 'minimal',
        headerBlurEffect: isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterial',
        headerStyle: { backgroundColor: 'transparent' },
        headerTintColor: colors.grey,
        headerRight,
      }}
    />
  );
}
