import LayersMinimalisticLinearIcon from '@components/icons/solar/layers-minimalistic-linear';
import LinkMinimalistic2BoldIcon from '@components/icons/solar/link-minimalistic-2-bold';
import UserCircleLinearIcon from '@components/icons/solar/user-circle-linear';
import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { BottomSheetInput } from '@components/ui/input';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BUTTON_BORDER_RADIUS } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { ApiClient, type FeedDiscoveryResult } from '@readspace/shared';
import { useMutation } from '@tanstack/react-query';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, Linking, Pressable, View } from 'react-native';

export interface AddFeedBottomSheetRef {
  present: () => void;
  dismiss: () => void;
}

export interface AddFeedBottomSheetProps {
  onConfirm: (url: string) => void;
}

function formatContentType(contentType: string): string {
  return contentType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const AddFeedBottomSheet = forwardRef<AddFeedBottomSheetRef, AddFeedBottomSheetProps>(
  ({ onConfirm }, ref) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const [url, setUrl] = useState('');
    const [feedPreview, setFeedPreview] = useState<FeedDiscoveryResult | null>(null);
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];

    const { mutate: previewUrl, isPending: isPreviewing } = useMutation({
      mutationFn: (searchUrl: string) => ApiClient.previewFeed(searchUrl),
      onSuccess: (data) => {
        setFeedPreview(data);
        Keyboard.dismiss();
        // Smoothly expand to the tall preview snap point (index 1)
        bottomSheetRef.current?.snapToIndex(1);
      },
      onError: () => {
        toast.error('Could not find a valid RSS feed at this URL.');
        setFeedPreview(null);
        // Keep at compact size on failure
        bottomSheetRef.current?.snapToIndex(0);
      },
    });

    const handlePreview = useCallback(() => {
      const trimmed = url.trim();
      if (!trimmed) return;
      previewUrl(trimmed);
    }, [url, previewUrl]);

    const handleConfirm = useCallback(() => {
      const trimmed = url.trim();
      if (!trimmed) return;
      onConfirm(trimmed);
      bottomSheetRef.current?.dismiss();
      setUrl('');
      setFeedPreview(null);
    }, [url, onConfirm]);

    const handleUrlPress = useCallback(async () => {
      const destUrl = feedPreview?.link || feedPreview?.url;
      if (!destUrl) return;
      const fullUrl = destUrl.startsWith('http') ? destUrl : `https://${destUrl}`;
      const supported = await Linking.canOpenURL(fullUrl);
      if (supported) {
        await Linking.openURL(fullUrl);
      } else {
        toast.error('Cannot open this URL');
      }
    }, [feedPreview]);

    useImperativeHandle(ref, () => ({
      present: () => {
        setUrl('');
        setFeedPreview(null);
        bottomSheetRef.current?.present();
        // Explicitly start at the compact snap point
        bottomSheetRef.current?.snapToIndex(0);
      },
      dismiss: () => {
        bottomSheetRef.current?.dismiss();
      },
    }));

    // Generate fallback avatar
    const fallbackTitle = feedPreview?.title || url;
    const fallbackAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackTitle)}&size=128&background=random&length=2&bold=true&format=png`;

    return (
      <BottomSheet
        ref={bottomSheetRef}
        enablePanDownToClose={true}
        snapPoints={['35%', '72%']}
        enableDynamicSizing={false}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore">
        {/* Header Title */}
        <Text
          className="font-geist-bold text-primary-foreground mb-1 text-2xl"
          style={{ letterSpacing: -0.5 }}>
          Add feed
        </Text>

        {/* Subtitle */}
        <Text className="font-geist-regular text-grey dark:text-grey mb-4 text-base">
          Enter an RSS feed URL to subscribe.
        </Text>

        {/* URL Input */}
        <BottomSheetInput
          value={url}
          onChangeText={(val) => {
            setUrl(val);
            if (feedPreview) {
              setFeedPreview(null);
              // Snap back to compact size when url is modified
              bottomSheetRef.current?.snapToIndex(0);
            }
          }}
          placeholder="https://example.com/feed.xml"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="search"
          onSubmitEditing={handlePreview}
          borderRadius={14}
          editable={!isPreviewing}
        />

        {/* Loading State */}
        {isPreviewing && (
          <View className="mt-8 items-center justify-center">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text className="font-geist text-grey dark:text-grey mt-3 text-sm">
              Finding feed...
            </Text>
          </View>
        )}

        {/* Premium Feed Preview Card */}
        {!isPreviewing && feedPreview && (
          <View
            className="border-divider mt-4 flex-col gap-3 rounded-xl border p-4"
            style={{ backgroundColor: colors.grey6 }}>
            {/* Feed Info Row */}
            <View className="flex-row items-start gap-3">
              {/* Avatar */}
              <View
                className="mt-0.5 h-14 w-14 items-center justify-center overflow-hidden rounded-xl"
                style={{ backgroundColor: colors.grey5 }}>
                {feedPreview.image_url ? (
                  <Image
                    source={{ uri: feedPreview.image_url }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                ) : (
                  <Image
                    source={{ uri: fallbackAvatarUrl }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                )}
              </View>

              {/* Title & Author & Content Type */}
              <View className="flex-1">
                <Text
                  size="base"
                  fontFamily="geist-semibold"
                  className="mb-1.5 tracking-tight text-black"
                  numberOfLines={2}>
                  {feedPreview.title || 'Untitled Feed'}
                </Text>

                <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1.5">
                  {/* Author */}
                  {feedPreview.author ? (
                    <View className="flex-row items-center gap-1">
                      <UserCircleLinearIcon
                        width={12}
                        height={12}
                        color={colors.grey}
                        strokeWidth={1.8}
                      />
                      <Text
                        size="sm"
                        fontFamily="geist"
                        style={{ color: colors.grey, fontSize: 11 }}
                        numberOfLines={1}>
                        {feedPreview.author}
                      </Text>
                    </View>
                  ) : null}

                  {/* Content Type */}
                  {feedPreview.content_type ? (
                    <View className="flex-row items-center gap-1">
                      <LayersMinimalisticLinearIcon
                        width={12}
                        height={12}
                        color={colors.grey}
                        strokeWidth={1.8}
                      />
                      <Text
                        size="sm"
                        fontFamily="geist"
                        style={{ color: colors.grey, fontSize: 11 }}>
                        {formatContentType(feedPreview.content_type)}
                      </Text>
                    </View>
                  ) : null}

                  {/* Language Badge */}
                  {feedPreview.language ? (
                    <View
                      className="rounded px-1.5 py-0.5"
                      style={{ backgroundColor: colors.grey5 }}>
                      <Text
                        fontFamily="geist-medium"
                        style={{
                          color: colors.grey,
                          fontSize: 8,
                          letterSpacing: 0.3,
                          textTransform: 'uppercase',
                        }}>
                        {feedPreview.language}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Description (flows naturally, no white line) */}
            {feedPreview.description ? (
              <Text size="sm" fontFamily="geist" className="text-grey leading-5">
                {feedPreview.description}
              </Text>
            ) : null}

            {/* URL / Canonical Link */}
            {feedPreview.link || feedPreview.url ? (
              <Pressable
                onPress={handleUrlPress}
                className="flex-row items-center gap-1.5 self-start py-0.5">
                <LinkMinimalistic2BoldIcon
                  width={12}
                  height={12}
                  strokeWidth={2.4}
                  color={colors.primary}
                />
                <Text
                  size="sm"
                  fontFamily="geist"
                  className="flex-1 flex-shrink text-left"
                  style={{ color: colors.primary, fontSize: 11 }}
                  numberOfLines={1}>
                  {feedPreview.link || feedPreview.url}
                </Text>
              </Pressable>
            ) : null}

            {/* Tags Badges */}
            {(() => {
              const displayTagsRaw =
                feedPreview.tags_native && feedPreview.tags_native.length > 0
                  ? feedPreview.tags_native
                  : feedPreview.tags;
              if (!displayTagsRaw || displayTagsRaw.length === 0) return null;
              const displayTags: string[] = Array.from(
                new Set<string>(
                  displayTagsRaw
                    .flatMap((tag: string) => tag.split(','))
                    .map((tag: string) => {
                      const decoded = tag
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                        .replace(/&apos;/g, "'")
                        .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
                        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
                          String.fromCharCode(parseInt(hex, 16))
                        );
                      return decoded.trim();
                    })
                    .filter(Boolean)
                )
              );
              if (displayTags.length === 0) return null;
              return (
                <View className="flex-row flex-wrap items-center gap-1.5">
                  {displayTags.slice(0, 4).map((tag: string, index: number) => {
                    const formattedTag = tag.replace(/\s+/g, '-');
                    return (
                      <View
                        key={`${tag}-${index.toString()}`}
                        className="flex-row items-center rounded px-2 py-0.5"
                        style={{ backgroundColor: colors.grey5 }}>
                        <Text
                          size="sm"
                          fontFamily="geist"
                          style={{ color: colors.grey, fontSize: 10 }}>
                          #{formattedTag}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );
            })()}
          </View>
        )}

        {/* Inline Action Button */}
        <View className="mb-1 mt-4">
          {!feedPreview ? (
            <Button
              variant="primary"
              size="large"
              fullWidth
              onPress={handlePreview}
              disabled={!url.trim() || isPreviewing}
              style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
              Preview
            </Button>
          ) : (
            <Button
              variant="primary"
              size="large"
              fullWidth
              onPress={handleConfirm}
              style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
              Confirm
            </Button>
          )}
        </View>
      </BottomSheet>
    );
  }
);

AddFeedBottomSheet.displayName = 'AddFeedBottomSheet';
