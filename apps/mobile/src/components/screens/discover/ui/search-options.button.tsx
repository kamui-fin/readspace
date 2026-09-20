import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { SettingsMinimalisticIcon } from '@solar-icons/react-native/linear';
import { Pressable } from 'react-native';

interface SearchOptionsButtonProps {
  onPress: () => void;
}

/**
 * Opens the search options sheet. Lives inside the search pill, mirroring the
 * back/magnifier control on the left — same 44pt square, same edge inset — so
 * the field reads as symmetrical rather than lopsided.
 *
 * Deliberately carries no active-state marker: both a tinted glyph and a badge
 * dot drew more attention than the field's own text. The sheet itself shows
 * what's on.
 */
export function SearchOptionsButton({ onPress }: SearchOptionsButtonProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Search options"
      onPress={onPress}
      hitSlop={10}
      className="items-center justify-center active:opacity-60"
      style={{ width: 44, height: 44 }}>
      <SettingsMinimalisticIcon size={21} strokeWidth={2} color={colors.grey} />
    </Pressable>
  );
}
