import { NativeHost } from '@components/ui/native-host';
import { Button, HStack, Image, Menu, Section } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  contentShape,
  frame,
  foregroundStyle,
  imageScale,
  labelStyle,
  menuIndicator,
  menuStyle,
  padding,
  rotationEffect,
  shapes,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { SUPPORTS_GLASS } from '@lib/constants/platform';
import { Stack } from 'expo-router';
import { useCallback } from 'react';
import type { ArticleActionBarProps } from './article-actions.bar.types';
import {
  availableViewModes,
  OPEN_IN_BROWSER_LABEL,
  VIEW_MODE_SECTION_TITLE,
  viewModeLabel,
} from './article-options-menu/types';

export type { ArticleActionBarProps } from './article-actions.bar.types';

const BOOKMARK_YELLOW = '#FBBC04';

/** Height of the SwiftUI host in the bar — one navigation-bar row. */
const BAR_HEIGHT = 44;

/**
 * The SwiftUI host is laid out by the navigation bar, not by us, and it sits hard against the
 * trailing edge — a glyph touching the bezel. This is the gutter the bar's own controls would
 * have had.
 *
 * Applied on both sides: the host is sized to its content, so without a leading gutter the first
 * glyph (Share) starts flush against the host's edge and reads as unpadded next to the gap the
 * other four get from `spacing`.
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
 *
 * `menuIndicator('hidden')`: an icon-only menu trigger has no room for SwiftUI's default chevron.
 */
const OVERFLOW_GLYPH = [buttonStyle('plain'), menuStyle('button'), menuIndicator('hidden')];

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
 * On iOS 26 the bar is *only* a scroll edge effect — the soft one, the progressive blur that
 * fades out downward the way Mail's does — and carries no material of its own. A
 * `headerBlurEffect` on top of it is the documented overlap case in react-native-screens: the two
 * stack into an opaque slab that swallows the fade, which is why the blur was visible over the
 * hero for one frame and never again. Below iOS 26 there is no edge effect, so the chrome
 * material stays as the fallback.
 *
 * Viewing modes use plain menu actions with a checkmark icon on the selected mode, avoiding
 * the leading selection gutter that an inline Picker adds to the entire menu.
 */
export function ArticleActionBar({
  visible = true,
  onShare,
  onBookmark,
  onGenerateSummary,
  onCopyLink,
  isBookmarked,
  isClipped,
  showDone = false,
  options,
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
        <HStack
          spacing={20}
          modifiers={[padding({ leading: BAR_EDGE_INSET, trailing: BAR_EDGE_INSET })]}>
          <Button
            label="Share"
            systemImage="square.and.arrow.up"
            onPress={onShare}
            modifiers={[...BAR_GLYPH, tint(colors.grey), foregroundStyle(colors.grey)]}
          />
          {!isClipped && onGenerateSummary && (
            <Button
              label="AI Summary"
              systemImage="sparkles"
              onPress={onGenerateSummary}
              modifiers={[...BAR_GLYPH, tint(colors.grey), foregroundStyle(colors.grey)]}
            />
          )}
          {onCopyLink && (
            <Button
              label="Copy link"
              systemImage="link"
              onPress={onCopyLink}
              modifiers={[...BAR_GLYPH, tint(colors.grey), foregroundStyle(colors.grey)]}
            />
          )}
          <Button
            label={showDone ? 'Mark as read' : 'Bookmark'}
            systemImage={bookmarkIcon}
            onPress={onBookmark}
            modifiers={[...BAR_GLYPH, tint(bookmarkTint), foregroundStyle(bookmarkTint)]}
          />
          {options && (
            <Menu
              label={
                <Image
                  systemName="ellipsis"
                  size={22}
                  color={colors.grey}
                  modifiers={[
                    accessibilityLabel('More options'),
                    rotationEffect(90),
                    frame({ width: 44, height: BAR_HEIGHT }),
                    contentShape(shapes.rectangle()),
                  ]}
                />
              }
              modifiers={[...OVERFLOW_GLYPH, tint(colors.grey)]}>
              {options.onOpenInBrowser && (
                <Section>
                  <Button
                    label={OPEN_IN_BROWSER_LABEL}
                    systemImage="safari"
                    onPress={options.onOpenInBrowser}
                  />
                </Section>
              )}
              {/* Plain actions avoid the leading selection gutter reserved by a Picker. */}
              <Section title={VIEW_MODE_SECTION_TITLE}>
                {availableViewModes(options).map((mode) => (
                  <Button
                    key={mode}
                    label={viewModeLabel(mode, options)}
                    systemImage={options.currentView === mode ? 'checkmark' : undefined}
                    onPress={() => options.onSelectView(mode)}
                  />
                ))}
              </Section>
            </Menu>
          )}
        </HStack>
      </NativeHost>
    ),
    [
      onShare,
      onGenerateSummary,
      onCopyLink,
      onBookmark,
      options,
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
        headerBlurEffect: SUPPORTS_GLASS
          ? undefined
          : isDark
            ? 'systemChromeMaterialDark'
            : 'systemChromeMaterial',
        // The article's outer ScrollView is the first scroll view under this Screen, so the
        // effect attaches to it. `hidden` on the other three edges: only the top edge is under
        // chrome, and an automatic bottom effect would fade the last line of the article out.
        //
        // The top edge follows `visible`, because the fade belongs to the bar. Tapping the page
        // to dismiss the chrome and leaving a blur band over nothing would be worse than the
        // opaque header this replaced.
        scrollEdgeEffects: SUPPORTS_GLASS
          ? { top: visible ? 'soft' : 'hidden', bottom: 'hidden', left: 'hidden', right: 'hidden' }
          : undefined,
        headerStyle: { backgroundColor: 'transparent' },
        headerTintColor: colors.grey,
        headerRight,
      }}
    />
  );
}
