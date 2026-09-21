import { Text } from '@components/ui/text';
import { type MenuAction, type MenuComponentRef, MenuView } from '@expo/ui/community/menu';
import { useRef } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { READER_CORNER_BUTTON_SIZE, type ReaderCornerMenuProps } from './reader-corner-menu.types';

/** SF Symbols exist on iOS only; elsewhere the menu row is text-only. */
const icon = (sfSymbol: MenuAction['image']) => (Platform.OS === 'ios' ? sfSymbol : undefined);

/**
 * The reader's corner menu on every platform: our own "Aa" button opening Expo UI's native
 * menu, so the menu itself is a real UIMenu / Android popup while the trigger stays ours.
 */
export function ReaderCornerMenu({
  colors,
  onOpenSettings,
  onScrollToTop,
  onOpenOutline,
  skim,
  onTranslate,
}: ReaderCornerMenuProps) {
  const menuRef = useRef<MenuComponentRef>(null);
  // `image` takes an SF Symbol on iOS and a drawable name on Android; Android has no matching
  // drawables shipped, so it falls back to a text-only row there rather than showing nothing.
  const actions: MenuAction[] = [
    { id: 'settings', title: 'Reader Settings', image: icon('textformat') },
    ...(onOpenOutline
      ? [{ id: 'outline', title: 'Table of Contents', image: icon('list.bullet') }]
      : []),
    ...(skim
      ? [
          {
            id: 'skim',
            title: skim.generating ? 'AI Skim Mode · Generating…' : 'AI Skim Mode',
            image: icon('sparkles'),
            state: skim.active ? ('on' as const) : ('off' as const),
            attributes: { disabled: skim.generating },
          },
        ]
      : []),
    ...(onTranslate ? [{ id: 'translate', title: 'Translate', image: icon('translate') }] : []),
    { id: 'top', title: 'Scroll to Top', image: icon('arrow.up.to.line') },
  ];

  const onPressAction = ({ nativeEvent: { event } }: { nativeEvent: { event: string } }) => {
    if (event === 'settings') onOpenSettings();
    else if (event === 'outline') onOpenOutline?.();
    else if (event === 'skim') skim?.onPress();
    else if (event === 'translate') onTranslate?.();
    else if (event === 'top') onScrollToTop();
  };

  return (
    <MenuView ref={menuRef} actions={actions} onPressAction={onPressAction}>
      <Pressable
        onPress={() => menuRef.current?.show()}
        accessibilityRole="button"
        accessibilityLabel="Reader menu"
        accessibilityHint="Open reader settings and actions"
        className="items-center justify-center rounded-full"
        style={({ pressed }) => ({
          width: READER_CORNER_BUTTON_SIZE,
          height: READER_CORNER_BUTTON_SIZE,
          backgroundColor: colors.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.grey4,
          opacity: pressed ? 0.6 : 1,
        })}>
        <View>
          <Text size={15} fontFamily="geist-semibold" style={{ color: colors.primary_foreground }}>
            Aa
          </Text>
        </View>
      </Pressable>
    </MenuView>
  );
}
