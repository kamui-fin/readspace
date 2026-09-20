import { SettingsGroup } from '@components/screens/profile/ui/settings-group';
import { SettingsItem } from '@components/screens/profile/ui/settings-item';
import { SettingsValueChip } from '@components/screens/profile/ui/settings-value.chip';
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItemIcon,
  DropdownMenuItemTitle,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { ScrollView, View } from 'react-native';
import type { SettingsPickerRow, SettingsRow, SettingsViewProps } from './types';

export type {
  SettingsPickerOption,
  SettingsRow,
  SettingsSection,
  SettingsViewProps,
} from './types';

function PickerRow({ row, isLast }: { row: SettingsPickerRow; isLast: boolean }) {
  const current = row.options.find((option) => option.value === row.value);
  const currentLabel = current?.label ?? row.value;

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
        <DropdownMenuRoot>
          <DropdownMenuTrigger asChild>
            <SettingsValueChip value={currentLabel} />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {row.options.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                value={row.value === option.value ? 'on' : 'off'}
                onValueChange={() => row.onChange(option.value)}
                className="px-4 py-3">
                <DropdownMenuItemIcon ios={{ name: option.systemImage }} />
                <DropdownMenuItemTitle size="lg" fontFamily="geist">
                  {option.label}
                </DropdownMenuItemTitle>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenuRoot>
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

/** Android / default settings layout: our own grouped rows inside a scroll view. */
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
