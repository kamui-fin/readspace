import EyeBoldIcon from '@components/icons/solar/eye-bold';
import EyeClosedBoldIcon from '@components/icons/solar/eye-closed-bold';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import type { ArticleFilter } from '@stores/following';
import { Pressable, View } from 'react-native';

interface FilterActionButtonProps {
  filter: ArticleFilter;
  onFilterChange: (filter: ArticleFilter) => void;
}

export function FilterActionButton({ filter, onFilterChange }: FilterActionButtonProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const isUnreadOnly = filter === 'unread';

  const handlePress = () => {
    onFilterChange(isUnreadOnly ? 'all' : 'unread');
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        backgroundColor: isUnreadOnly
          ? isDark
            ? 'rgba(106, 153, 78, 0.25)'
            : colors.muted_green
          : colors.grey5,
        opacity: pressed ? 0.7 : 1,
      })}>
      <View style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
        {isUnreadOnly ? (
          <EyeBoldIcon width={18} height={18} color={colors.secondary} />
        ) : (
          <EyeClosedBoldIcon width={18} height={18} color={colors.grey2} />
        )}
      </View>
    </Pressable>
  );
}
