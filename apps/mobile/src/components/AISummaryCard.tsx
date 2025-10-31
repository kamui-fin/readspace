import { Monicon } from '@monicon/native';
import { Pressable, Text, View } from 'react-native';

export interface AISummaryCardProps {
    summary?: string;
    isLoading?: boolean;
    onClose?: () => void;
}

export function AISummaryCard({ summary, isLoading = false, onClose }: AISummaryCardProps) {
    if (!summary) return null;

    return (
        <View className="mx-6 mb-6 rounded-lg border border-light-grey bg-light-grey/30 dark:border-light-grey-dark dark:bg-light-grey-dark/30">
            <View className="flex-row items-start gap-3 p-4">
                <Monicon name="solar:magic-stick-3-bold" size={18} color="#6A994E" />
                <Text className="flex-1 font-geist text-sm leading-relaxed text-grey dark:text-grey-dark">
                    {summary}
                </Text>
                {onClose && (
                    <Pressable
                        onPress={onClose}
                        className="h-6 w-6 items-center justify-center rounded-full active:bg-light-grey dark:active:bg-light-grey-dark"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Monicon name="lucide:x" size={14} color="#90988B" />
                    </Pressable>
                )}
            </View>
        </View>
    );
}
