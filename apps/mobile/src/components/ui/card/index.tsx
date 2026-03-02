import EyeLinearIcon from '@components/icons/solar/eye-linear';
import { Divider } from '@components/ui/divider';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { stripHtml } from '@lib/utils/html';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import { Image as ExpoImage } from 'expo-image';
import type { ReactNode } from 'react';
import { forwardRef, useState } from 'react';
import { Pressable, type PressableProps, View } from 'react-native';

const cardVariants = cva('bg-background dark:bg-background-dark', {
  variants: {
    variant: {
      feed: 'flex-row items-center gap-4 py-4 px-4',
      'image-top':
        'w-full rounded-2xl bg-white dark:bg-grey6-dark overflow-hidden border border-black/5 dark:border-white/5',
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
  fallbackComponent?: React.FC<{ size?: number; className?: string }>;
  feedName?: string;
  showTopDivider?: boolean;
  showBottomDivider?: boolean;
  // Text-only variant props
  content?: ReactNode;
  isRead?: boolean;
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
      fallbackComponent: FallbackComponent,
      feedName,
      showTopDivider = false,
      showBottomDivider = true,
      content,
      isRead,
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
              <ExpoImage
                source={{ uri: iconUrl }}
                style={{ width: 48, height: 48 }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={150}
                onError={() => setImageError(true)}
              />
            ) : fallbackAvatarUrl ? (
              <ExpoImage
                source={{ uri: fallbackAvatarUrl }}
                style={{ width: 48, height: 48 }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={150}
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
                size="sm"
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
        <View className={clsx(isRead && 'opacity-60')}>
          {/* Top divider - edge-to-edge, no horizontal margin */}
          {showTopDivider && <Divider />}
          <Pressable ref={ref} className={clsx(cardVariants({ variant }), className)} {...props}>
            {/* Content on left */}
            <View className="flex-1">
              {/* Feed name and timestamp header */}
              {(feedName || timestamp) && (
                <View className="mb-3 flex-row items-center gap-1.5">
                  {/* Favicon */}
                  {faviconUrl ? (
                    <ExpoImage
                      source={{ uri: faviconUrl }}
                      style={{ width: 16, height: 16, borderRadius: 4 }}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={150}
                    />
                  ) : FallbackComponent ? (
                    <FallbackComponent size={16} className="rounded-sm" />
                  ) : null}

                  {/* Feed name */}
                  {feedName && (
                    <Text
                      size="xs"
                      fontFamily="geist"
                      className="text-grey dark:text-grey"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={{ flexShrink: 1 }}>
                      {feedName}
                    </Text>
                  )}

                  {/* Read time icon */}
                  {timestamp && (
                    <>
                      <EyeLinearIcon width={12} height={12} color="#90988B" />
                      <Text
                        size="xs"
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
                  className={clsx(
                    'mb-1 leading-5 tracking-tight',
                    isRead
                      ? 'text-grey dark:text-grey'
                      : 'text-primary-foreground dark:text-primary-foreground-dark'
                  )}
                  numberOfLines={3}>
                  {stripHtml(title)}
                </Text>
              )}
              {description && (
                <Text
                  size={13}
                  fontFamily="geist"
                  className={clsx(
                    'leading-5',
                    isRead ? 'text-grey/70 dark:text-grey-dark/70' : 'text-grey dark:text-grey-dark'
                  )}
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
                  style={{ width: 96, height: 96 }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                  placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                  placeholderContentFit="cover"
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
        <Pressable
          ref={ref}
          className={clsx(cardVariants({ variant }), className)}
          style={[
            {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
              elevation: 3,
            },
            props.style as any,
          ]}
          {...props}>
          {imageUrl && (
            <View className="w-full bg-grey5 dark:bg-grey5-dark" style={{ height: 160 }}>
              <ExpoImage
                source={{ uri: imageUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
                placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                placeholderContentFit="cover"
              />
            </View>
          )}
          <View className="p-4 flex-1">
            {title && (
              <Text
                size="base"
                fontFamily="geist-semibold"
                className="mb-1.5 leading-5 tracking-tight text-primary-foreground dark:text-primary-foreground-dark"
                numberOfLines={2}
                ellipsizeMode="tail">
                {stripHtml(title)}
              </Text>
            )}
            {description && (
              <Text
                size={13}
                fontFamily="geist"
                className="mb-3 leading-5 text-grey2 dark:text-grey2"
                numberOfLines={2}
                ellipsizeMode="tail">
                {stripHtml(description)}
              </Text>
            )}

            {/* Bottom Meta Row */}
            <View className="mt-auto flex-row items-center justify-between pt-1">
              {timestamp && (
                <View className="flex-row items-center gap-1.5">
                  <EyeLinearIcon width={12} height={12} color="#90988b" />
                  <Text
                    size="xs"
                    fontFamily="geist"
                    className="text-grey dark:text-grey"
                    numberOfLines={1}
                    ellipsizeMode="tail">
                    {timestamp}
                  </Text>
                </View>
              )}
            </View>
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
