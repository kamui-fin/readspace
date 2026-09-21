import { SettingsGroup } from '@components/screens/profile/ui/settings-group';
import { SettingsItem } from '@components/screens/profile/ui/settings-item';
import { SettingsValueChip } from '@components/screens/profile/ui/settings-value.chip';
import { type MenuAction, type MenuComponentRef, MenuView } from '@expo/ui/community/menu';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { useRef } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import type { SettingsPickerRow, SettingsRow, SettingsViewProps } from './types';

export type {
  SettingsPickerOption,
  SettingsRow,
  SettingsSection,
  SettingsViewProps,
} from './types';

function PickerRow({ row, isLast }: { row: SettingsPickerRow; isLast: boolean }) {
  const menuRef = useRef<MenuComponentRef>(null);
  const current = row.options.find((option) => option.value === row.value);
  const currentLabel = current?.label ?? row.value;
  const actions: MenuAction[] = row.options.map((option) => ({
    id: option.value,
    title: option.label,
    image: option.systemImage,
    state: row.value === option.value ? 'on' : 'off',
  }));

  return (
    // The menu trigger is scoped to the value chip, not the row: iOS lifts whatever it opens
    // from, and lifting a full-width row leaves a visible hole in the group.
    <SettingsItem
      label={row.label}
      variant="select"
      value={currentLabel}
      leftIcon={row.icon}
      isLast={isLast}
      trailing={
        <MenuView
          ref={menuRef}
          actions={actions}
          onPressAction={({ nativeEvent }) => row.onChange(nativeEvent.event)}>
          {/*
           * Android's MenuView opens from its own `Pressable` wrapper around these children, so a
           * `Pressable` chip inside it wins the responder and the menu never opens. Drive it
           * imperatively there instead. iOS needs no handler — SwiftUI's `Menu` gets the tap
           * natively — and `show()` is a documented no-op there, so we don't wire it.
           */}
          <SettingsValueChip
            value={currentLabel}
            onPress={Platform.OS === 'android' ? () => menuRef.current?.show() : undefined}
          />
        </MenuView>
      }
    />
  );
}

function renderRow(row: SettingsRow, isLast: boolean) {
  if (row.type === 'picker') {
    return <PickerRow key={row.key} row={row} isLast={isLast} />;
  }
  return (
    <SettingsItem
      key={row.key}
      label={row.label}
      variant={row.kind}
      leftIcon={row.icon}
      onPress={row.onPress}
      disabled={row.disabled}
      danger={row.danger}
      isLast={isLast}
    />
  );
}

/**
 * Settings layout on every platform: our own grouped rows inside a scroll view. The native
 * SwiftUI `Form` variant was tried on iOS and dropped — the custom groups read better and stay
 * identical across iOS and Android.
 */
export function SettingsView({ header, intro, sections, bottomInset }: SettingsViewProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  return (
    <View className="bg-background flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: bottomInset }}
        showsVerticalScrollIndicator={false}>
        {header}
        <View className="mt-4 px-6">
          {intro}
          {sections.map((section, index) => (
            <SettingsGroup
              key={section.key}
              title={section.title}
              className={index === sections.length - 1 ? 'mb-8' : 'mb-6'}>
              {section.rows.map((row, rowIndex) =>
                renderRow(row, rowIndex === section.rows.length - 1)
              )}
            </SettingsGroup>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
