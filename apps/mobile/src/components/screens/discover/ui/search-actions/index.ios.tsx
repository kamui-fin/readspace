import { NativeHost } from '@components/ui/native-host';
import { Button, HStack } from '@expo/ui/swift-ui';
import { buttonStyle, labelStyle, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import type { SearchActionsProps } from './types';

export type { SearchActionsProps } from './types';

/**
 * Fixed size for the SwiftUI host: it is placed as a navigation bar `headerRight`, where a
 * self-sizing host has no layout pass to size against and collapses.
 */
const HOST_HEIGHT = 44;
const HOST_WIDTH = 152;

/**
 * iOS: the three controls as a navigation bar `headerRight`.
 *
 * All three live in ONE SwiftUI host with an `HStack`, not one host each: a Host is a native view
 * that sizes to its own content, so three of them sit flush against each other with no way to
 * space them. Inside a single stack, `spacing` does the work.
 *
 * iOS 26 wraps whatever `headerRight` returns in a single Liquid Glass capsule. That capsule hugs
 * this stack's bounds, so the leading and trailing padding has to come from the stack itself —
 * without it the outer two glyphs sit flush against the glass edge while the gaps between them
 * look wider.
 *
 * `plain` keeps each button a bare glyph so they don't draw their own capsule inside that one.
 */
export function SearchActions({
  onOpenOptions,
  onOpenLanguage,
  onOpenAddFeed,
}: SearchActionsProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  return (
    <NativeHost style={{ height: HOST_HEIGHT, width: HOST_WIDTH }}>
      <HStack spacing={20} modifiers={[padding({ horizontal: 14 })]}>
        <Button
          label="Search options"
          systemImage="gearshape"
          onPress={onOpenOptions}
          modifiers={[labelStyle('iconOnly'), buttonStyle('plain'), tint(colors.grey)]}
        />
        <Button
          label="Search language"
          systemImage="globe"
          onPress={onOpenLanguage}
          modifiers={[labelStyle('iconOnly'), buttonStyle('plain'), tint(colors.grey)]}
        />
        <Button
          label="Add feed"
          systemImage="plus"
          onPress={onOpenAddFeed}
          modifiers={[labelStyle('iconOnly'), buttonStyle('plain'), tint(colors.grey)]}
        />
      </HStack>
    </NativeHost>
  );
}
