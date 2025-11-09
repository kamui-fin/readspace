import { Badge } from '@/components/ui/Badge';
import { Tab } from '@/components/ui/Tab';
import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
    Extrapolation,
    interpolate,
    useAnimatedStyle,
    type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface TabConfig {
    label: string;
    iconName: string;
}

interface BaseHeaderProps {
    title: string;
    className?: string;
    leftAction?: ReactNode;
    rightAction?: ReactNode;
}

interface StickyHeaderProps extends BaseHeaderProps {
    variant: 'sticky';
    scrollY?: never;
    tabs?: never;
    activeTab?: never;
    onTabChange?: never;
    unreadCount?: never;
    onHeaderHeightChange?: never;
}

interface TabbedHeaderProps extends BaseHeaderProps {
    variant: 'tabbed';
    scrollY: SharedValue<number>;
    tabs: TabConfig[];
    activeTab: number;
    onTabChange: (index: number) => void;
    unreadCount?: number;
    onHeaderHeightChange?: (height: number) => void;
}

export type HeaderProps = StickyHeaderProps | TabbedHeaderProps;

export const Header = (props: HeaderProps) => {
    const { title, variant, className, leftAction, rightAction } = props;
    const insets = useSafeAreaInsets();

    const [foregroundHeight, setForegroundHeight] = useState(0);
    const [tabsHeight, setTabsHeight] = useState(0);

    // Extract tabbed-specific props if variant is tabbed
    const tabs = useMemo(() => (variant === 'tabbed' ? props.tabs : []), [variant, props]);
    const activeTab = variant === 'tabbed' ? props.activeTab : 0;
    const onTabChange = variant === 'tabbed' ? props.onTabChange : undefined;
    const unreadCount = variant === 'tabbed' ? props.unreadCount : undefined;
    const scrollY = variant === 'tabbed' ? props.scrollY : undefined;
    const onHeaderHeightChange = variant === 'tabbed' ? props.onHeaderHeightChange : undefined;

    useEffect(() => {
        if (variant === 'tabbed') {
            const totalHeight = foregroundHeight + tabsHeight;
            if (totalHeight > 0 && onHeaderHeightChange) {
                onHeaderHeightChange(totalHeight);
            }
        }
    }, [foregroundHeight, tabsHeight, onHeaderHeightChange, variant]);

    const renderForeground = useCallback(
        () => (
            <View
                className="flex-row items-center justify-between gap-2 px-4 pb-2"
                onLayout={(e) => setForegroundHeight(e.nativeEvent.layout.height)}>
                {leftAction && <View className="mr-2">{leftAction}</View>}
                <View className="flex-1 flex-row items-center gap-2 overflow-hidden">
                    <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        className="flex-shrink font-geist-bold text-3xl tracking-heading text-black dark:text-black-dark">
                        {title}
                    </Text>
                    {unreadCount !== undefined && unreadCount > 0 && (
                        <Badge label={unreadCount.toString()} />
                    )}
                </View>
                {rightAction && <View className="ml-2">{rightAction}</View>}
            </View>
        ),
        [title, unreadCount, leftAction, rightAction]
    );

    const renderTabs = useCallback(() => {
        if (variant !== 'tabbed') return null;

        return (
            <View
                className="mb-2 flex-row items-center gap-2 bg-white px-4 py-2 dark:bg-white-dark"
                onLayout={(e) => setTabsHeight(e.nativeEvent.layout.height)}>
                {tabs.map((tab, index) => (
                    <Tab
                        key={tab.label}
                        label={tab.label}
                        iconName={tab.iconName}
                        active={activeTab === index}
                        onPress={() => onTabChange?.(index)}
                    />
                ))}
            </View>
        );
    }, [variant, tabs, activeTab, onTabChange]);

    // Animated styles for tabbed variant
    const animatedHeaderStyle = useAnimatedStyle(() => {
        if (variant !== 'tabbed' || !scrollY) {
            return {};
        }
        const translation = interpolate(
            scrollY.value,
            [0, foregroundHeight],
            [0, -foregroundHeight],
            Extrapolation.CLAMP
        );
        return {
            transform: [{ translateY: translation }],
        };
    });

    const animatedForegroundStyle = useAnimatedStyle(() => {
        if (variant !== 'tabbed' || !scrollY) {
            return {};
        }
        return {
            opacity: interpolate(
                scrollY.value,
                [0, foregroundHeight / 2],
                [1, 0],
                Extrapolation.CLAMP
            ),
        };
    });

    // Render sticky variant
    if (variant === 'sticky') {
        return (
            <View className={cn('w-full bg-white dark:bg-white-dark', className)}>
                {renderForeground()}
            </View>
        );
    }

    // Render tabbed variant
    return (
        <Animated.View
            className={cn('absolute w-full bg-white dark:bg-white-dark', className)}
            style={[{ paddingTop: insets.top, zIndex: 10 }, animatedHeaderStyle]}>
            <Animated.View style={animatedForegroundStyle}>{renderForeground()}</Animated.View>
            {renderTabs()}
        </Animated.View>
    );
};
