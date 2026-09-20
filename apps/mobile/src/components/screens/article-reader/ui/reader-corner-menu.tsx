import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemTitle,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';
import { Text } from '@components/ui/text';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { READER_CORNER_BUTTON_SIZE, type ReaderCornerMenuProps } from './reader-corner-menu.types';

/**
 * Android (and any non-iOS) corner menu, built on the app's existing zeego
 * wrapper. iOS uses the SwiftUI menu in `reader-corner-menu.ios.tsx`; both take
 * the same props, so the reader never branches on platform.
 */
export function ReaderCornerMenu({
  colors,
  isDark: _isDark,
  onOpenSettings,
  onScrollToTop,
  onOpenOutline,
  skim,
}: ReaderCornerMenuProps) {
  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger asChild>
        <Pressable
          accessibilityLabel="Reader menu"
          className="items-center justify-center rounded-full"
          style={({ pressed }) => ({
            width: READER_CORNER_BUTTON_SIZE,
            height: READER_CORNER_BUTTON_SIZE,
            backgroundColor: colors.card,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.grey4,
            opacity: pressed ? 0.6 : 1,
            elevation: Platform.OS === 'android' ? 4 : 0,
          })}>
          <View>
            <Text size={15} fontFamily="geist-semibold" style={{ color: colors.grey }}>
              Aa
            </Text>
          </View>
        </Pressable>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem key="settings" onSelect={onOpenSettings}>
          <DropdownMenuItemTitle>Reader Settings</DropdownMenuItemTitle>
        </DropdownMenuItem>
        {onOpenOutline && (
          <DropdownMenuItem key="outline" onSelect={onOpenOutline}>
            <DropdownMenuItemTitle>Table of Contents</DropdownMenuItemTitle>
          </DropdownMenuItem>
        )}
        {skim && (
          <DropdownMenuCheckboxItem
            key="skim"
            value={skim.active ? 'on' : 'off'}
            disabled={skim.generating}
            onValueChange={skim.onPress}>
            <DropdownMenuItemTitle>
              {skim.generating ? 'AI Skim Mode · Generating…' : 'AI Skim Mode'}
            </DropdownMenuItemTitle>
          </DropdownMenuCheckboxItem>
        )}
        <DropdownMenuItem key="top" onSelect={onScrollToTop}>
          <DropdownMenuItemTitle>Scroll to Top</DropdownMenuItemTitle>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
}
