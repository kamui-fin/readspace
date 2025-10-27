import { cn } from '@/utils/cn';
import { forwardRef } from 'react';
import { Image, Pressable, type PressableProps, Text, View } from 'react-native';
import { CompletedBadge } from './CompletedBadge';

export interface BookCardProps extends PressableProps {
    title: string;
    coverUrl?: string;
    pagesLeft?: number;
    isCompleted?: boolean;
    className?: string;
}

export const BookCard = forwardRef<React.ElementRef<typeof Pressable>, BookCardProps>(
    ({ title, coverUrl, pagesLeft, isCompleted, className, ...props }, ref) => {
        return (
            <Pressable ref={ref} className={cn('w-full', className)} {...props}>
                <View className="relative mb-3 aspect-[2/3] w-full overflow-hidden rounded-2xl bg-mid-grey">
                    {coverUrl && (
                        <Image
                            source={{ uri: coverUrl }}
                            className="h-full w-full"
                            resizeMode="cover"
                        />
                    )}
                    {isCompleted && (
                        <View className="absolute right-2 top-2">
                            <CompletedBadge />
                        </View>
                    )}
                    {!isCompleted && pagesLeft !== undefined && (
                        <View className="absolute bottom-0 left-0 right-0 h-2 bg-mid-grey">
                            <View
                                className="h-full bg-secondary rounded"
                                style={{
                                    width: `${Math.max(5, 100 - (pagesLeft / 500) * 100)}%`,
                                }}
                            />
                        </View>
                    )}
                </View>
                <Text
                    className="mb-1 font-geist-semibold text-base text-black"
                    numberOfLines={1}
                    ellipsizeMode="tail">
                    {title}
                </Text>
                {isCompleted ? (
                    <Text className="font-geist text-sm text-grey">Completed</Text>
                ) : pagesLeft !== undefined ? (
                    <Text className="font-geist text-sm text-grey">{pagesLeft} p. left</Text>
                ) : null}
            </Pressable>
        );
    }
);

BookCard.displayName = 'BookCard';

