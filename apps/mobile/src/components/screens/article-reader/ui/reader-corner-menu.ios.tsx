import { Host } from '@expo/ui';
import { Button, Menu } from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  labelStyle,
  menuIndicator,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { Platform } from 'react-native';
import type { ReaderCornerMenuProps } from './reader-corner-menu.types';

/** Liquid Glass button styles only exist from iOS 26; older systems get the bordered fallback. */
const SUPPORTS_GLASS = Number.parseInt(String(Platform.Version), 10) >= 26;

/**
 * The reader's corner menu as a real SwiftUI `Menu` — the same control Apple
 * Books uses, so it gets system blur, haptics, spring animation, and Liquid
 * Glass on iOS 26 without any of that being reimplemented.
 *
 * The Host is forced to the reader's colour scheme rather than the system's:
 * the reader can be on sepia or dark while the app is in light mode, and the
 * menu chrome has to follow the page, not the phone.
 */
export function ReaderCornerMenu({
  colors,
  isDark,
  onOpenSettings,
  onScrollToTop,
  onOpenOutline,
  skim,
}: ReaderCornerMenuProps) {
  return (
    <Host matchContents colorScheme={isDark ? 'dark' : 'light'}>
      <Menu
        label="Reader menu"
        systemImage="textformat.size"
        modifiers={[
          labelStyle('iconOnly'),
          buttonStyle(SUPPORTS_GLASS ? 'glass' : 'bordered'),
          buttonBorderShape('circle'),
          controlSize('large'),
          menuIndicator('hidden'),
          tint(colors.grey),
        ]}>
        <Button label="Reader Settings" systemImage="textformat" onPress={onOpenSettings} />
        {onOpenOutline && (
          <Button label="Table of Contents" systemImage="list.bullet" onPress={onOpenOutline} />
        )}
        {skim && (
          <Button
            label={skim.generating ? 'AI Skim Mode · Generating…' : 'AI Skim Mode'}
            systemImage={skim.active ? 'checkmark' : 'sparkles'}
            onPress={skim.generating ? undefined : skim.onPress}
          />
        )}
        <Button label="Scroll to Top" systemImage="arrow.up.to.line" onPress={onScrollToTop} />
      </Menu>
    </Host>
  );
}
