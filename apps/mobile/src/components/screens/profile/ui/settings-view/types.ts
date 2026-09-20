import type { Button } from '@expo/ui/swift-ui';
import type { ComponentProps, ReactNode } from 'react';

/** An SF Symbol name (iOS-only surfaces). */
export type SettingsSymbol = NonNullable<ComponentProps<typeof Button>['systemImage']>;

interface SettingsRowBase {
  key: string;
  label: string;
  /** RN icon for the Android / fallback renderer. */
  icon: ReactNode;
  /** SF Symbol for the native iOS renderer. */
  systemImage: SettingsSymbol;
  danger?: boolean;
  disabled?: boolean;
}

export interface SettingsActionRow extends SettingsRowBase {
  type: 'action';
  /** `link` opens something outside the app; `button` navigates or runs an action. */
  kind: 'button' | 'link';
  onPress: () => void;
}

export interface SettingsPickerOption {
  value: string;
  label: string;
  systemImage: SettingsSymbol;
}

export interface SettingsPickerRow extends SettingsRowBase {
  type: 'picker';
  value: string;
  options: SettingsPickerOption[];
  onChange: (value: string) => void;
}

export type SettingsRow = SettingsActionRow | SettingsPickerRow;

export interface SettingsSection {
  key: string;
  title?: string;
  rows: SettingsRow[];
}

export interface SettingsViewProps {
  /** Screen header (static title bar). */
  header: ReactNode;
  /** Content shown above the grouped rows, e.g. the account card. */
  intro?: ReactNode;
  sections: SettingsSection[];
  /** Space to keep clear at the bottom for the tab bar. */
  bottomInset: number;
}
