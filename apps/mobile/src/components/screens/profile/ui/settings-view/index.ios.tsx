import { NativeHost } from '@components/ui/native-host';
import { Button, Form, Picker, Section, Text } from '@expo/ui/swift-ui';
import {
  disabled,
  pickerStyle,
  scrollContentBackground,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { View } from 'react-native';
import type { SettingsRow, SettingsViewProps } from './types';

export type {
  SettingsPickerOption,
  SettingsRow,
  SettingsSection,
  SettingsViewProps,
} from './types';

/**
 * iOS settings: RN keeps the static header and account card (brand chrome), and everything
 * below is ONE native SwiftUI `Form` (inset-grouped, system row metrics, haptics, iOS 26 glass)
 * that fills the remaining height and does its own scrolling.
 */
export function SettingsView({ header, intro, sections, bottomInset }: SettingsViewProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const renderRow = (row: SettingsRow) => {
    if (row.type === 'picker') {
      return (
        <Picker
          key={row.key}
          label={row.label}
          systemImage={row.systemImage}
          selection={row.value}
          onSelectionChange={row.onChange}
          modifiers={[pickerStyle('menu')]}>
          {row.options.map((option) => (
            <Text key={option.value} modifiers={[tag(option.value)]}>
              {option.label}
            </Text>
          ))}
        </Picker>
      );
    }
    return (
      <Button
        key={row.key}
        label={row.label}
        systemImage={row.systemImage}
        role={row.danger ? 'destructive' : 'default'}
        onPress={row.onPress}
        modifiers={[tint(row.danger ? colors.red : colors.black), disabled(Boolean(row.disabled))]}
      />
    );
  };

  return (
    <View className="bg-background flex-1" style={{ backgroundColor: colors.background }}>
      {header}
      {intro && <View className="mt-4 px-6">{intro}</View>}
      <View style={{ flex: 1, paddingBottom: bottomInset }}>
        <NativeHost matchContents={false} style={{ flex: 1 }}>
          <Form modifiers={[scrollContentBackground('hidden')]}>
            {sections.map((section) => (
              <Section key={section.key} title={section.title}>
                {section.rows.map(renderRow)}
              </Section>
            ))}
          </Form>
        </NativeHost>
      </View>
    </View>
  );
}
