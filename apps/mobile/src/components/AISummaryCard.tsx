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
            <View className="mx-6 mb-6 overflow-hidden rounded-2xl border border-green-grey bg-white">
                {/* Header */}
                <View className="flex-row items-center justify-between border-b border-green-grey bg-light-grey px-4 py-3">
                    <View className="flex-1 flex-row items-center gap-2">
                        <Monicon name="solar:magic-stick-3-bold" size={18} color="#6A994E" />
                        <Text className="font-geist-semibold text-sm text-primary">AI Summary</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                        {/* Collapse/Expand Button */}
                        <Pressable
                            onPress={() => setIsExpanded(!isExpanded)}
                            className="h-7 w-7 items-center justify-center rounded-full"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Monicon
                                name={isExpanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                                size={16}
                                color="#6A994E"
                            />
                        </Pressable>
                        {/* Close Button */}
                        <Pressable
                            onPress={onClose}
                            className="h-7 w-7 items-center justify-center rounded-full"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Monicon name="lucide:x" size={16} color="#6A994E" />
                        </Pressable>
                    </View>
                </View>

                {/* Content */}
                {isExpanded && (
                    <View className="px-4 py-4">
                        {isLoading ? (
                            <View className="flex-row items-center gap-3 py-4">
                                <ActivityIndicator size="small" color="#6A994E" />
                                <Text className="font-geist text-sm text-grey">
                                    Generating AI summary...
                                </Text>
                            </View>
                        ) : (
                            <Text className="font-geist text-base leading-relaxed text-black">
                                {summary}
                            </Text>
                        )}
                    </View>
                )}
            </View>
        </Animated.View>
    );
}
