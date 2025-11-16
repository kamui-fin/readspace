import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { forwardRef, useState } from 'react';
import { Image, Pressable, type PressableProps, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

import { Text } from '@components/ui/text';
import { Divider } from '@components/ui/divider';
import { RssIcon } from '@components/icons/rss';
import { Monicon } from '@monicon/native';
import { stripHtml } from '@lib/utils/html';
import { useIsDarkMode } from '@hooks/useIsDarkMode';

const cardVariants = cva('bg-background dark:bg-background-dark', {
  variants: {
    variant: {
      feed: 'flex-row items-center gap-4 py-4 px-4',
      'image-top': 'overflow-hidden rounded-2xl border border-grey4 dark:border-grey4-dark',
      article: 'flex-row gap-3 py-4', // Edge-to-edge article card with image on right
      'text-only': 'rounded-2xl border border-grey4 dark:border-grey4-dark p-4',
    },
  },
  defaultVariants: {
    variant: 'text-only',
  },
});

export interface CardProps
  extends Omit<PressableProps, 'children'>,
    VariantProps<typeof cardVariants> {
  children?: ReactNode;
  className?: string;
  // Feed variant props
  iconUrl?: string;
  title?: string;
  description?: string;
  actionButton?: ReactNode;
  // Image-top and Article variant props
  imageUrl?: string;
  timestamp?: string;
  faviconUrl?: string;
  feedName?: string;
  showTopDivider?: boolean;
  showBottomDivider?: boolean;
  // Text-only variant props
  content?: ReactNode;
}

/**
 * Primitive Card component focused on layout variants.
 * For swipeable functionality, use SwipeableCard wrapper.
 * For custom content, use children or content prop.
 */
export const Card = forwardRef<React.ComponentRef<typeof Pressable>, CardProps>(
  (
    {
      variant = 'text-only',
      className,
      iconUrl,
      title,
      description,
      actionButton,
      imageUrl,
      timestamp,
      faviconUrl,
      feedName,
      showTopDivider = false,
      showBottomDivider = true,
      content,
      children,
      ...props
    },
    ref
  ) => {
    const [imageError, setImageError] = useState(false);
    const isDark = useIsDarkMode();

    // Generate UI Avatars fallback URL for feed icons
    const fallbackAvatarUrl = title
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&size=128&background=random&length=2&bold=true&format=png`
      : undefined;

    // Feed variant - horizontal layout with icon, text, and action button
    if (variant === 'feed') {
      return (
        <Pressable ref={ref} className={clsx(cardVariants({ variant }), className)} {...props}>
          {/* Icon */}
          <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-grey5 dark:bg-grey5-dark">
            {iconUrl && !imageError ? (
              <Image
                source={{ uri: iconUrl }}
                className="h-full w-full"
                resizeMode="cover"
                onError={() => setImageError(true)}
              />
            ) : fallbackAvatarUrl ? (
              <Image
                source={{ uri: fallbackAvatarUrl }}
                className="h-full w-full"
                resizeMode="cover"
              />
            ) : null}
          </View>

          {/* Content */}
          <View className="flex-1">
            {title && (
              <Text
                size="xl"
                fontFamily="geist-semibold"
                className="mb-1 text-primary-foreground dark:text-primary-foreground-dark"
                numberOfLines={1}>
                {stripHtml(title)}
              </Text>
            )}
            {description && (
              <Text
                size="lg"
                fontFamily="geist"
                className="text-grey2 dark:text-grey2"
                numberOfLines={2}>
                {stripHtml(description)}
              </Text>
            )}
          </View>

          {/* Action Button */}
          {actionButton}
        </Pressable>
      );
    }

    // Article variant - edge-to-edge, image on right, text on left
    if (variant === 'article') {
      return (
        <View>
          {/* Top divider - edge-to-edge, no horizontal margin */}
          {showTopDivider && <Divider />}
          <Pressable ref={ref} className={clsx(cardVariants({ variant }), className)} {...props}>
            {/* Content on left */}
            <View className="flex-1">
              {/* Feed name and timestamp header */}
              {(feedName || timestamp) && (
                <View className="mb-3 flex-row items-center gap-2">
                  {/* Favicon */}
                  {faviconUrl ? (
                    <View className="h-4 w-4 overflow-hidden rounded-sm">
                      <ExpoImage
                        source={{ uri: faviconUrl }}
                        style={{ width: 16, height: 16 }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={200}
                      />
                    </View>
                  ) : (
                    <View className="h-4 w-4 items-center justify-center rounded-sm bg-orange-100 dark:bg-orange-950">
                      <RssIcon size={12} color={isDark ? '#9a3412' : '#ea580c'} />
                    </View>
                  )}

                  {/* Feed name */}
                  {feedName && (
                    <Text
                      size="sm"
                      fontFamily="geist"
                      className="text-grey dark:text-grey"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={{ flexShrink: 1 }}>
                      {feedName}
                    </Text>
                  )}

                  {/* Clock icon */}
                  {timestamp && (
                    <>
                      <Monicon name="solar:clock-circle-linear" size={14} color="#90988B" />
                      <Text
                        size="sm"
                        fontFamily="geist"
                        className="text-grey dark:text-grey"
                        numberOfLines={1}
                        ellipsizeMode="tail">
                        {timestamp}
                      </Text>
                    </>
                  )}
                </View>
              )}
              {title && (
                <Text
                  size="base"
                  fontFamily="geist-semibold"
                  className="mb-1 leading-5 tracking-tight text-primary-foreground dark:text-primary-foreground-dark"
                  numberOfLines={3}>
                  {stripHtml(title)}
                </Text>
              )}
              {description && (
                <Text
                  size="sm"
                  fontFamily="geist"
                  className="leading-5 text-grey dark:text-grey-dark"
                  numberOfLines={2}>
                  {stripHtml(description)}
                </Text>
              )}
            </View>

            {/* Thumbnail on right - only show if imageUrl exists */}
            {imageUrl && (
              <View className="h-24 w-24 overflow-hidden rounded-xl bg-grey5 dark:bg-grey5-dark">
                <ExpoImage
                  source={{ uri: imageUrl }}
                  className="h-full w-full"
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                  onError={() => setImageError(true)}
                />
              </View>
            )}
          </Pressable>
          {/* Bottom divider - edge-to-edge, no horizontal margin */}
          {showBottomDivider && <Divider />}
        </View>
      );
    }

    // Image-top variant - image fills top, text below
    if (variant === 'image-top') {
      return (
        <Pressable ref={ref} className={clsx(cardVariants({ variant }), className)} {...props}>
          {imageUrl && (
            <Image source={{ uri: imageUrl }} className="h-48 w-full" resizeMode="cover" />
          )}
          <View className="p-4">
            {timestamp && (
              <View className="mb-2 flex-row items-center gap-2">
                <View className="h-1.5 w-1.5 rounded-full bg-primary" />
                <Text
                  size="md"
                  fontFamily="geist"
                  className="text-grey dark:text-grey"
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {timestamp}
                </Text>
              </View>
            )}
            {title && (
              <Text
                size="base"
                fontFamily="geist-semibold"
                className="leading-6 text-primary-foreground dark:text-primary-foreground-dark"
                numberOfLines={3}
                ellipsizeMode="tail">
                {stripHtml(title)}
              </Text>
            )}
            {description && (
              <Text
                size="lg"
                fontFamily="geist"
                className="mt-2 leading-5 text-grey2 dark:text-grey2"
                numberOfLines={3}
                ellipsizeMode="tail">
                {stripHtml(description)}
              </Text>
            )}
          </View>
        </Pressable>
      );
    }

    // Text-only variant - just text content or custom children
    return (
      <Pressable ref={ref} className={clsx(cardVariants({ variant }), className)} {...props}>
        {content || children}
      </Pressable>
    );
  }
);

Card.displayName = 'Card';
