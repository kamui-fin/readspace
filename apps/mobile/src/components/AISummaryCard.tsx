import { Monicon } from '@monicon/native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

export interface AISummaryCardProps {
    summary?: string;
    isLoading?: boolean;
    onClose?: () => void;
}

export function AISummaryCard({ summary, isLoading = false, onClose }: AISummaryCardProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    if (!summary && !isLoading) return null;

    return (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
            <View className="mx-6 mb-6 overflow-hidden rounded-xl border border-light-grey bg-white shadow-sm dark:border-light-grey-dark dark:bg-white-dark">
                {/* Header */}
                <View className="flex-row items-center justify-between px-5 py-4">
                    <View className="flex-1 flex-row items-center gap-3">
                        <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
                            <Monicon name="solar:magic-stick-3-bold" size={16} color="#6A994E" />
                        </View>
                        <Text className="font-geist-semibold text-base text-black dark:text-black-dark">
                            AI Summary
                        </Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                        {/* Collapse/Expand Button */}
                        <Pressable
                            onPress={() => setIsExpanded(!isExpanded)}
                            className="h-8 w-8 items-center justify-center rounded-full active:bg-light-grey dark:active:bg-light-grey-dark"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Monicon
                                name={
                                    isExpanded
                                        ? 'solar:alt-arrow-up-linear'
                                        : 'solar:alt-arrow-down-linear'
                                }
                                size={18}
                                color="#90988B"
                            />
                        </Pressable>
                        {/* Close Button */}
                        <Pressable
                            onPress={onClose}
                            className="h-8 w-8 items-center justify-center rounded-full active:bg-light-grey dark:active:bg-light-grey-dark"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Monicon name="lucide:x" size={18} color="#90988B" />
                        </Pressable>
                    </View>
                </View>

                {/* Content */}
                {isExpanded && (
                    <View className="border-t border-light-grey px-5 pb-5 pt-4 dark:border-light-grey-dark">
                        {isLoading ? (
                            <View className="flex-row items-center gap-3 py-2">
                                <ActivityIndicator size="small" color="#6A994E" />
                                <Text className="font-geist text-sm text-grey dark:text-grey-dark">
                                    Generating summary...
                                </Text>
                            </View>
                        ) : (
                            <Text className="font-geist text-[15px] leading-relaxed text-grey dark:text-grey-dark">
                                {summary}
                            </Text>
                        )}
                    </View>
                )}
            </View>
        </Animated.View>
    );
}
