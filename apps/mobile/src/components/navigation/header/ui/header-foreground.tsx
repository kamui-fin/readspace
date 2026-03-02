import ExpandVerticalIcon from '@components/icons/local/expand-vertical';
import ArrowLeftLinearIcon from '@components/icons/solar/arrow-left-linear';
import { Button } from '@components/ui/button';
import { COLORS } from '@lib/constants/colors';
import clsx from 'clsx';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import {
  actionsContainerVariants,
  foregroundVariants,
  subtitleVariants,
  titleContainerVariants,
  titleVariants,
} from '@/components/navigation/header/constants/header-variants';

interface HeaderForegroundProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  actions?: {
    label: string;
    icon: React.ComponentType<{
      width?: number;
      height?: number;
      color?: string;
      strokeWidth?: number;
    }>;
    onPress: () => void;
    disabled?: boolean;
  }[];
  titleFontWeight?: 'bold' | 'semibold';
  onTitlePress?: () => void;
  colors: typeof COLORS.light | typeof COLORS.dark;
  onLayout: (e: { nativeEvent: { layout: { height: number } } }) => void;
}

export function HeaderForeground({
  title,
  subtitle,
  showBackButton = false,
  onBackPress,
  actions = [],
  titleFontWeight = 'bold',
  onTitlePress,
  colors,
  onLayout,
}: HeaderForegroundProps) {
  // Determine if we should use centered layout (for similar feeds with back button and no actions)
  const useCenteredLayout = showBackButton && actions.length === 0 && !subtitle;
  const titleSize = useCenteredLayout ? 'small' : 'default';

  if (useCenteredLayout) {
    return (
      <View className="flex-row items-center pb-3 w-full absolute" onLayout={onLayout}>
        {showBackButton && (
          <View className="absolute left-4 top-0 z-10">
            <Button onPress={onBackPress} variant="icon" size="small" fullWidth={false}>
              <ArrowLeftLinearIcon width={18} height={18} strokeWidth={2.4} color={colors.grey} />
            </Button>
          </View>
        )}

        <View className="flex-1 items-center px-16">
          <Text
            className={clsx(titleVariants({ fontWeight: titleFontWeight, size: titleSize }))}
            numberOfLines={1}
            ellipsizeMode="tail">
            {title}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className={clsx(foregroundVariants({ layout: 'default' }))} onLayout={onLayout}>
      {showBackButton && (
        <Button
          onPress={onBackPress}
          variant="icon"
          size="small"
          fullWidth={false}
          className="mr-3">
          <ArrowLeftLinearIcon width={18} height={18} strokeWidth={2.4} color={colors.grey} />
        </Button>
      )}

      <View className={clsx(titleContainerVariants({ layout: 'default' }))}>
        {onTitlePress ? (
          <TouchableOpacity
            onPress={onTitlePress}
            className="flex-row items-center gap-0.5 active:opacity-70">
            <Text
              className={clsx(
                titleVariants({
                  fontWeight: titleFontWeight,
                  size: titleSize,
                })
              )}
              numberOfLines={1}
              ellipsizeMode="tail">
              {title}
            </Text>
            <View
              className="justify-center"
              style={{ marginBottom: Platform.OS === 'ios' ? 6 : 2 }}>
              <ExpandVerticalIcon width={24} height={24} fill={colors.black} />
            </View>
          </TouchableOpacity>
        ) : (
          <Text
            className={clsx(titleVariants({ fontWeight: titleFontWeight, size: titleSize }))}
            numberOfLines={1}
            ellipsizeMode="tail">
            {title}
          </Text>
        )}
        {subtitle && (
          <Text className={clsx(subtitleVariants())} numberOfLines={1} ellipsizeMode="tail">
            {subtitle}
          </Text>
        )}
      </View>

      {actions.length > 0 && (
        <View className={clsx(actionsContainerVariants())}>
          {actions.map((action) => (
            <Button
              key={action.label}
              onPress={action.onPress}
              variant="secondary"
              size="small"
              fullWidth={false}
              disabled={action.disabled}
              className="bg-transparent px-2 py-2">
              <action.icon width={20} height={20} color={colors.primary_foreground} />
            </Button>
          ))}
        </View>
      )}
    </View>
  );
}
