import ExpandVerticalIcon from '@components/icons/local/expand-vertical';
import ArrowLeftLinearIcon from '@components/icons/solar/arrow-left-linear';
import { Button } from '@components/ui/button';
import { Text } from '@components/ui/text';
import { COLORS } from '@lib/constants/colors';
import clsx from 'clsx';
import { Platform, TouchableOpacity, View } from 'react-native';
import {
  actionsContainerVariants,
  foregroundVariants,
  subtitleVariants,
  titleContainerVariants,
  titleVariants,
} from '@/components/navigation/header/constants/header-variants';

interface HeaderForegroundProps {
  title: string;
  titleIcon?: React.ReactNode;
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
  titleSize?: 'default' | 'medium' | 'small' | 'xs';
  onTitlePress?: () => void;
  colors: typeof COLORS.light | typeof COLORS.dark;
  onLayout: (e: { nativeEvent: { layout: { height: number } } }) => void;
  rightElement?: React.ReactNode;
  disableCenteredLayout?: boolean;
  unreadCount?: number;
}

export function HeaderForeground({
  title,
  titleIcon,
  subtitle,
  unreadCount,
  showBackButton = false,
  onBackPress,
  actions = [],
  titleFontWeight = 'bold',
  titleSize: titleSizeProp,
  onTitlePress,
  colors,
  onLayout,
  rightElement,
  disableCenteredLayout = false,
}: HeaderForegroundProps) {
  // Determine if we should use centered layout (for similar feeds with back button and no actions)
  const useCenteredLayout =
    !disableCenteredLayout && showBackButton && actions.length === 0 && !subtitle;
  const titleSize = titleSizeProp ?? (useCenteredLayout ? 'small' : 'default');

  if (useCenteredLayout) {
    return (
      <View className="w-full flex-row items-center pb-3" onLayout={onLayout}>
        {showBackButton && (
          <View className="absolute left-4 top-0 z-10">
            <Button onPress={onBackPress} variant="icon" size="small" fullWidth={false}>
              <ArrowLeftLinearIcon width={18} height={18} strokeWidth={2.4} color={colors.grey} />
            </Button>
          </View>
        )}

        <View className="flex-1 items-center px-16">
          <View className="flex-row items-center gap-1.5">
            {titleIcon}
            <Text
              className={clsx(titleVariants({ fontWeight: titleFontWeight, size: titleSize }))}
              numberOfLines={1}
              ellipsizeMode="tail">
              {title}
            </Text>
          </View>
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
            {titleIcon && <View className="mr-1.5">{titleIcon}</View>}
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
              <ExpandVerticalIcon width={24} height={24} color={colors.black} fill={colors.black} />
            </View>
          </TouchableOpacity>
        ) : (
          <View className="flex-row items-center gap-1.5">
            {titleIcon}
            <Text
              className={clsx(titleVariants({ fontWeight: titleFontWeight, size: titleSize }))}
              numberOfLines={1}
              ellipsizeMode="tail">
              {title}
            </Text>
          </View>
        )}
        {subtitle && (
          <Text className={clsx(subtitleVariants())} numberOfLines={1} ellipsizeMode="tail">
            {subtitle}
          </Text>
        )}
      </View>

      {(actions.length > 0 || rightElement || (unreadCount !== undefined && unreadCount > 0)) && (
        <View className={clsx(actionsContainerVariants())}>
          {unreadCount !== undefined && unreadCount > 0 && (
            <View
              className="px-2.5 py-0.5 rounded-full items-center justify-center"
              style={{
                backgroundColor:
                  colors === COLORS.dark
                    ? 'rgba(255, 255, 255, 0.15)'
                    : 'rgba(255, 255, 255, 0.75)',
                borderWidth: 1,
                borderColor:
                  colors === COLORS.dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              }}>
              <Text
                className="font-geist-bold text-sm"
                style={{
                  color: colors === COLORS.dark ? '#ffffff' : colors.black,
                }}>
                {unreadCount}
              </Text>
            </View>
          )}
          {rightElement}
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
