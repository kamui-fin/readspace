import FeedLinearIcon from '@components/icons/solar/feed-linear';
import LayersMinimalisticLinearIcon from '@components/icons/solar/layers-minimalistic-linear';
import LetterOpenedLinearIcon from '@components/icons/solar/letter-opened-linear';
import LinkMinimalistic2BoldIcon from '@components/icons/solar/link-minimalistic-2-bold';
import SolarCopyLinearIcon from '@components/icons/solar/copy-linear';
import SolarCheckCircleLinearIcon from '@components/icons/solar/check-circle-linear';
import UserCircleLinearIcon from '@components/icons/solar/user-circle-linear';
import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { FeedFallbackIcon } from '@components/ui/feed-fallback-icon';
import { BottomSheetInput } from '@components/ui/input';
import { Skeleton } from '@components/ui/skeleton';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRevenueCat } from '@contexts/revenuecat-context';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BUTTON_BORDER_RADIUS } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { ApiClient, type FeedDiscoveryResult } from '@readspace/shared';
import { useUpgradeDialog } from '@stores/upgrade-dialog';
import { useMutation, useQuery } from '@tanstack/react-query';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

export interface AddFeedBottomSheetRef {
  present: () => void;
  dismiss: () => void;
}

export interface AddFeedBottomSheetProps {
  onConfirm: (url: string) => void;
}

type Mode = 'rss' | 'newsletter';

function formatContentType(contentType: string): string {
  return contentType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const AddFeedBottomSheet = forwardRef<AddFeedBottomSheetRef, AddFeedBottomSheetProps>(
  ({ onConfirm }, ref) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const [mode, setMode] = useState<Mode>('rss');
    const [url, setUrl] = useState('');
    const [feedPreview, setFeedPreview] = useState<FeedDiscoveryResult | null>(null);
    const [copied, setCopied] = useState(false);
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];
    const { isPro } = useRevenueCat();
    const { open: openUpgrade } = useUpgradeDialog();

    // Tab animation state
    const [containerWidth, setContainerWidth] = useState(0);
    const translation = useSharedValue(0);

    useEffect(() => {
      if (containerWidth > 0) {
        const activeWidth = (containerWidth - 6) / 2; // Subtracting 3px padding on both sides
        translation.value = withTiming(mode === 'rss' ? 0 : activeWidth, {
          duration: 200,
        });
      }
    }, [mode, containerWidth]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translation.value }],
      width: containerWidth > 0 ? (containerWidth - 6) / 2 : '50%',
    }));

    // Fetch newsletter token — only when on newsletter tab and user is pro
    const { data: tokenData, isLoading: isTokenLoading } = useQuery({
      queryKey: ['newsletterToken'],
      queryFn: () => ApiClient.getNewsletterToken(),
      enabled: mode === 'newsletter' && isPro,
      staleTime: Infinity, // Token doesn't change between sessions
    });

    const { mutate: previewUrl, isPending: isPreviewing } = useMutation({
      mutationFn: (searchUrl: string) => ApiClient.previewFeed(searchUrl),
      onSuccess: (data) => {
        setFeedPreview(data);
        Keyboard.dismiss();
        bottomSheetRef.current?.snapToIndex(0);
      },
      onError: () => {
        toast.error('Could not find a valid RSS feed at this URL.');
        setFeedPreview(null);
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

    const handleCopy = useCallback(async () => {
      if (!tokenData?.email) return;
      try {
        const Clipboard = await import('expo-clipboard');
        await Clipboard.setStringAsync(tokenData.email);
        setCopied(true);
        toast.success('Copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error('Could not copy to clipboard');
      }
    }, [tokenData?.email]);

    const handleModeSwitch = useCallback(
      (next: Mode) => {
        if (next === 'newsletter' && !isPro) {
          openUpgrade({
            title: 'Upgrade to Readspace Pro',
            description:
              'Unlock newsletter ingestion and subscribe to Substack, Mailchimp, or any mailing list directly in your feed.',
          });
          return;
        }
        setMode(next);
        if (next === 'newsletter') {
          setUrl('');
          setFeedPreview(null);
        }
        bottomSheetRef.current?.snapToIndex(0);
      },
      [isPro, openUpgrade]
    );

    useImperativeHandle(ref, () => ({
      present: () => {
        setUrl('');
        setFeedPreview(null);
        setMode('rss');
        bottomSheetRef.current?.present();
        bottomSheetRef.current?.snapToIndex(0);
      },
      dismiss: () => {
        bottomSheetRef.current?.dismiss();
      },
    }));

    // Generate fallback icon for RSS preview
    const fallbackTitle = feedPreview?.title || url;

    // Toggle pill colors
    const pillBg = isDark ? colors.grey6 : colors.grey6;
    const activePillBg = isDark ? colors.grey4 : '#fff';
    const activeTextColor = isDark ? '#ffffff' : colors.primary;
    const inactiveTextColor = isDark ? colors.grey2 : colors.grey;

    // Use secondary (vibrant) green in dark mode for newsletter contents
    const contentGreen = isDark ? colors.secondary : colors.primary;

    return (
      <BottomSheet
        ref={bottomSheetRef}
        enablePanDownToClose={true}
        snapPoints={['85%']}
        enableDynamicSizing={false}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        footerActions={
          mode === 'rss' ? (
            <View style={{ width: '100%' }}>
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
          ) : null
        }>
        {/* Header */}
        <Text
          className="font-geist-bold text-primary-foreground mb-1 text-2xl"
          style={{ letterSpacing: -0.5 }}>
          Add feed
        </Text>

        {/* Mode Toggle */}
        <View
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
          style={[styles.toggleContainer, { backgroundColor: pillBg }]}>
          {containerWidth > 0 && (
            <Animated.View
              style={[
                styles.togglePillActiveBg,
                {
                  backgroundColor: activePillBg,
                  shadowColor: isDark ? '#000' : '#000',
                },
                animatedStyle,
              ]}
            />
          )}
          {(['rss', 'newsletter'] as Mode[]).map((m) => {
            const isActive = mode === m;
            return (
              <Pressable key={m} onPress={() => handleModeSwitch(m)} style={styles.togglePill}>
                {m === 'rss' ? (
                  <FeedLinearIcon
                    width={13}
                    height={13}
                    color={isActive ? activeTextColor : inactiveTextColor}
                    strokeWidth={1.8}
                  />
                ) : (
                  <LetterOpenedLinearIcon
                    width={13}
                    height={13}
                    color={isActive ? activeTextColor : inactiveTextColor}
                    strokeWidth={1.8}
                  />
                )}
                <Text
                  fontFamily={isActive ? 'geist-semibold' : 'geist-medium'}
                  style={{
                    fontSize: 13,
                    color: isActive ? activeTextColor : inactiveTextColor,
                    marginLeft: 5,
                  }}>
                  {m === 'rss' ? 'RSS Feed' : 'Newsletter'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── RSS MODE ── */}
        {mode === 'rss' && (
          <>
            <Text className="font-geist-regular text-grey dark:text-grey mb-4 mt-3 text-sm">
              Enter an RSS feed URL to subscribe.
            </Text>

            <BottomSheetInput
              value={url}
              onChangeText={(val) => {
                setUrl(val);
                if (feedPreview) {
                  setFeedPreview(null);
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

            {isPreviewing && (
              <View className="mt-8 items-center justify-center">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text className="font-geist text-grey dark:text-grey mt-3 text-sm">
                  Finding feed...
                </Text>
              </View>
            )}

            {!isPreviewing && feedPreview && (
              <View
                className="border-divider mt-4 flex-col gap-3 rounded-xl border p-4"
                style={{ backgroundColor: colors.grey6 }}>
                <View className="flex-row items-start gap-3">
                  <View
                    className="mt-0.5 h-14 w-14 items-center justify-center overflow-hidden rounded-xl"
                    style={{ backgroundColor: colors.grey5 }}>
                    {feedPreview.image_url ? (
                      <Image
                        source={{ uri: feedPreview.image_url }}
                        className="h-full w-full"
                        resizeMode="cover"
                        style={{ borderRadius: 12 }}
                      />
                    ) : (
                      <FeedFallbackIcon feedName={fallbackTitle} size={56} borderRadius={12} />
                    )}
                  </View>

                  <View className="flex-1">
                    <Text
                      size="base"
                      fontFamily="geist-semibold"
                      className="mb-1.5 tracking-tight text-black"
                      numberOfLines={2}>
                      {feedPreview.title || 'Untitled Feed'}
                    </Text>
                    <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1.5">
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

                {feedPreview.description ? (
                  <Text size="sm" fontFamily="geist" className="text-grey leading-5">
                    {feedPreview.description}
                  </Text>
                ) : null}

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
              </View>
            )}
          </>
        )}

        {/* ── NEWSLETTER MODE ── */}
        {mode === 'newsletter' && (
          <View className="mt-3 flex-1">
            <Text className="font-geist-regular text-grey dark:text-grey mb-5 text-sm">
              Use your private email alias to subscribe to any newsletter. Emails land straight in
              Readspace.
            </Text>

            {/* Steps */}
            <View style={styles.steps}>
              {/* Step 1 — Email alias */}
              <View style={styles.step}>
                <View style={styles.leftColumn}>
                  <View style={[styles.stepDot, { backgroundColor: contentGreen + '18' }]}>
                    <Text fontFamily="geist-semibold" style={{ fontSize: 11, color: contentGreen }}>
                      1
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.stepLine,
                      { backgroundColor: isDark ? colors.grey5 : colors.grey4 },
                    ]}
                  />
                </View>
                <View style={styles.stepBody}>
                  <Text fontFamily="geist-semibold" style={{ fontSize: 14, color: colors.black }}>
                    Copy your private address
                  </Text>
                  {/* Email alias block / Skeleton loading */}
                  {isTokenLoading ? (
                    <Skeleton height={46} className="w-full rounded-xl" />
                  ) : (
                    <Pressable
                      onPress={handleCopy}
                      style={[
                        styles.emailBlock,
                        {
                          backgroundColor: isDark ? colors.grey5 : colors.grey6,
                          borderColor: isDark ? colors.grey4 : colors.grey5,
                        },
                      ]}>
                      <View style={{ flex: 1, overflow: 'hidden' }}>
                        <Text
                          fontFamily="geist-medium"
                          numberOfLines={1}
                          style={{ fontSize: 12, color: colors.black, letterSpacing: -0.2 }}>
                          {tokenData?.email ?? '—'}
                        </Text>
                      </View>
                      {/* Copy icon */}
                      <View
                        style={[
                          styles.copyIcon,
                          { backgroundColor: isDark ? colors.grey4 : '#fff' },
                        ]}>
                        {copied ? (
                          <SolarCheckCircleLinearIcon
                            width={16}
                            height={16}
                            color={colors.secondary}
                          />
                        ) : (
                          <SolarCopyLinearIcon
                            width={16}
                            height={16}
                            color={isDark ? colors.grey2 : colors.grey}
                          />
                        )}
                      </View>
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Step 2 */}
              <View style={styles.step}>
                <View style={styles.leftColumn}>
                  <View style={[styles.stepDot, { backgroundColor: contentGreen + '18' }]}>
                    <Text fontFamily="geist-semibold" style={{ fontSize: 11, color: contentGreen }}>
                      2
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.stepLine,
                      { backgroundColor: isDark ? colors.grey5 : colors.grey4 },
                    ]}
                  />
                </View>
                <View style={styles.stepBody}>
                  <Text fontFamily="geist-semibold" style={{ fontSize: 14, color: colors.black }}>
                    Subscribe on any website
                  </Text>
                  <Text
                    fontFamily="geist"
                    style={{ fontSize: 13, color: colors.grey, lineHeight: 18, marginTop: 2 }}>
                    Paste this address in the subscription form on Substack, Mailchimp, or any
                    publication.
                  </Text>
                </View>
              </View>

              {/* Step 3 */}
              <View style={styles.step}>
                <View style={styles.leftColumn}>
                  <View style={[styles.stepDot, { backgroundColor: contentGreen + '18' }]}>
                    <Text fontFamily="geist-semibold" style={{ fontSize: 11, color: contentGreen }}>
                      3
                    </Text>
                  </View>
                  {/* No line for the last step */}
                </View>
                <View style={styles.stepBody}>
                  <Text fontFamily="geist-semibold" style={{ fontSize: 14, color: colors.black }}>
                    Read in Readspace
                  </Text>
                  <Text
                    fontFamily="geist"
                    style={{ fontSize: 13, color: colors.grey, lineHeight: 18, marginTop: 2 }}>
                    The first email auto-creates a feed in your{' '}
                    <Text fontFamily="geist-semibold" style={{ fontSize: 13, color: contentGreen }}>
                      Newsletters
                    </Text>{' '}
                    folder.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </BottomSheet>
    );
  }
);

AddFeedBottomSheet.displayName = 'AddFeedBottomSheet';

const styles = StyleSheet.create({
  toggleContainer: {
    position: 'relative',
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    marginTop: 16,
    marginBottom: 16,
  },
  togglePillActiveBg: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 9,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  togglePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
    zIndex: 1,
  },
  steps: {
    marginTop: 8,
  },
  step: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
    marginBottom: 8,
  },
  leftColumn: {
    alignItems: 'center',
    width: 24,
    alignSelf: 'stretch',
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  stepLine: {
    width: 2,
    flex: 1,
    marginTop: 6,
    marginBottom: -3,
  },
  stepBody: {
    flex: 1,
    paddingBottom: 16,
    gap: 6,
  },
  emailBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  copyIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
