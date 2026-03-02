import { Button } from '@components/ui/button';
import { Text } from '@components/ui/text';
import { View } from 'react-native';
import SolarArrowRightBoldIcon from '@/components/icons/solar/arrow-right-bold';

export interface SectionHeaderProps {
  title: string;
  onSeeAll?: () => void;
  seeAllText?: string;
  className?: string;
  iconColor?: string;
}

export function SectionHeader({
  title,
  onSeeAll,
  seeAllText = 'See all',
  className = '',
  iconColor = '#8c8c8c', // default grey
}: SectionHeaderProps) {
  return (
    <View className={`flex-row items-center justify-between ${className}`}>
      <Text
        size="xl"
        fontFamily="geist-semibold"
        variant="heading"
        className="tracking-tight text-black dark:text-black-dark">
        {title}
      </Text>
      {onSeeAll && (
        <Button
          variant="text"
          size="small"
          fullWidth={false}
          onPress={onSeeAll}
          className="h-auto flex-row items-center gap-0.5 px-0"
          rightIcon={<SolarArrowRightBoldIcon width={16} height={16} color={iconColor} />}>
          <Text size="sm" fontFamily="geist-medium" style={{ color: iconColor }}>
            {seeAllText}
          </Text>
        </Button>
      )}
    </View>
  );
}
