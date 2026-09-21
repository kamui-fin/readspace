import { NativeHost } from '@components/ui/native-host';
import { Button, Menu } from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  frame,
  imageScale,
  labelStyle,
  menuIndicator,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { StyleSheet } from 'react-native';
import { READER_CORNER_BUTTON_SIZE, type ReaderCornerMenuProps } from './reader-corner-menu.types';

export type { ReaderCornerMenuProps } from './reader-corner-menu.types';

/**
 * A native SwiftUI menu on the same quiet surface as the reading-progress control.
 *
 * Android keeps `index.tsx` (our pressable + Expo UI's cross-platform `MenuView`), because
 * Jetpack Compose is deliberately out of scope for this app's Android UI.
 */
export function ReaderCornerMenu({
  colors,
  onOpenSettings,
  onScrollToTop,
  onOpenOutline,
  skim,
  onTranslate,
}: ReaderCornerMenuProps) {
  return (
    <NativeHost
      matchContents={false}
      style={{
        width: READER_CORNER_BUTTON_SIZE,
        height: READER_CORNER_BUTTON_SIZE,
        borderRadius: READER_CORNER_BUTTON_SIZE / 2,
        backgroundColor: colors.card,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.grey4,
      }}>
      <Menu
        label="Reader menu"
        systemImage="textformat"
        modifiers={[
          labelStyle('iconOnly'),
          buttonStyle('plain'),
          buttonBorderShape('circle'),
          controlSize('large'),
          imageScale('large'),
          // An icon-only trigger has no room for SwiftUI's default menu chevron.
          menuIndicator('hidden'),
          frame({ width: READER_CORNER_BUTTON_SIZE, height: READER_CORNER_BUTTON_SIZE }),
          tint(colors.primary_foreground),
        ]}>
        <Button label="Reader Settings" systemImage="textformat" onPress={onOpenSettings} />
        {onOpenOutline && (
          <Button label="Table of Contents" systemImage="list.bullet" onPress={onOpenOutline} />
        )}
        {skim && (
          <Button
            label={skim.generating ? 'AI Skim Mode · Generating…' : 'AI Skim Mode'}
            // A filled sparkle stands in for the checkmark a `state` row would draw: this is a
            // plain action row, and the reader needs to see at a glance that skim is already on.
            systemImage={skim.active ? 'sparkles.rectangle.stack.fill' : 'sparkles'}
            onPress={skim.onPress}
            modifiers={[disabledModifier(skim.generating)]}
          />
        )}
        {onTranslate && <Button label="Translate" systemImage="translate" onPress={onTranslate} />}
        <Button label="Scroll to Top" systemImage="arrow.up.to.line" onPress={onScrollToTop} />
      </Menu>
    </NativeHost>
  );
}
