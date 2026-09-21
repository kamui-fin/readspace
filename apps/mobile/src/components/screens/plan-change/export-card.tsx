import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { CheckCircleIcon, DocumentTextIcon } from '@solar-icons/react-native/bold';
import { View } from 'react-native';

interface ExportCardProps {
  filename: string;
  feedCount: number;
  folderCount: number;
  hasExported: boolean;
}

/** The OPML file the reader is about to keep, on the same surface as the Settings groups. */
export function ExportCard({ filename, feedCount, folderCount, hasExported }: ExportCardProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const surface = isDark ? 'rgb(32, 32, 32)' : colors.grey6;
  const accent = isDark ? colors.secondary : colors.primary;

  return (
    <View
      className="flex-row items-center gap-4 rounded-xl px-5 py-4"
      style={{ backgroundColor: surface }}>
      {hasExported ? (
        <CheckCircleIcon size={28} color={accent} />
      ) : (
        <DocumentTextIcon size={28} color={colors.grey} />
      )}
      <View className="flex-1 gap-0.5">
        <Text
          size="sm"
          fontFamily="mono-medium"
          className="text-black dark:text-white"
          numberOfLines={1}>
          {filename}
        </Text>
        <Text size="sm" fontFamily="geist" className="text-grey dark:text-grey">
          {hasExported
            ? 'Shared. Keep it somewhere safe.'
            : `${feedCount} feeds in ${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}`}
        </Text>
      </View>
    </View>
  );
}
