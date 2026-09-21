import type { SheetRef } from '@components/ui/bottom-sheet';
import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { FeedFallbackIcon } from '@components/ui/feed-fallback-icon';
import { BottomSheetInput } from '@components/ui/input';
import { Skeleton } from '@components/ui/skeleton';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useRevenueCat } from '@contexts/revenuecat-context';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BUTTON_BORDER_RADIUS } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { ApiClient, type FeedDiscoveryResult } from '@readspace/shared';
import { LinkMinimalistic2Icon } from '@solar-icons/react-native/bold';
import {
  CheckCircleIcon,
  CopyIcon,
  LayersMinimalisticIcon,
  LetterOpenedIcon,
  UserCircleIcon,
} from '@solar-icons/react-native/linear';
import { useSettingsStore } from '@stores/settings';
import { useUpgradeDialog } from '@stores/upgrade-dialog';
import { useMutation, useQuery } from '@tanstack/react-query';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SourceModeToggle } from './source-mode.toggle';
import { FeedArticlePreviews } from './feed-article-previews';
import type { AddFeedMode } from './source-mode.toggle.types';

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
    const bottomSheetRef = useRef<SheetRef>(null);
    const [mode, setMode] = useState<AddFeedMode>('rss');
    const [url, setUrl] = useState('');
    const [feedPreview, setFeedPreview] = useState<FeedDiscoveryResult | null>(null);
    const [copied, setCopied] = useState(false);
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];
    const { isPro } = useRevenueCat();
    const { open: openUpgrade } = useUpgradeDialog();
    const isSelfHosted = useSettingsStore(
      (state) => state.settings.instance_type === 'self-hosted'
    );

    // Fetch newsletter token — only when on newsletter tab and user is pro
    const { data: tokenData, isLoading: isTokenLoading } = useQuery({
      queryKey: ['newsletterToken'],
      queryFn: () => ApiClient.getNewsletterToken(),
      enabled: mode === 'newsletter' && isPro && !isSelfHosted,
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
      (next: AddFeedMode) => {
        if (next === 'newsletter' && !isPro) {
          // Free tier: close this sheet and go straight to the paywall
          bottomSheetRef.current?.dismiss();
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

    // Use secondary (vibrant) green in dark mode for newsletter contents
    const contentGreen = isDark ? colors.secondary : colors.primary;

    return (
      <BottomSheet
        ref={bottomSheetRef}
        enablePanDownToClose={true}
        snapPoints={['85%']}
        // The title used to be the first line of the scroll content, which put it 16pt below the
        // grabber instead of the 30 the sheet header reserves — close enough to the grabber to
        // look like a mistake, and it scrolled away with the form. As a real header slot it gets
        // the sheet's own spacing and stays pinned.
        headerTitle="Add feed"
        headerTitleAlign="left"
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
        <SourceModeToggle mode={mode} onModeChange={handleModeSwitch} />

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
              <>
                <View
                  className="mt-4 flex-col gap-3 rounded-xl p-4"
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
                        className="mb-1.5 tracking-tight text-black dark:text-white"
                        numberOfLines={2}>
                        {feedPreview.title || 'Untitled Feed'}
                      </Text>
                      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1.5">
                        {feedPreview.author ? (
                          <View className="flex-row items-center gap-1">
                            <UserCircleIcon size={12} color={colors.grey} strokeWidth={1.8} />
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
                            <LayersMinimalisticIcon
                              size={12}
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
                      <LinkMinimalistic2Icon size={12} strokeWidth={2.4} color={colors.secondary} />
                      <Text
                        size="sm"
                        fontFamily="geist"
                        className="flex-1 flex-shrink text-left"
                        style={{ color: colors.secondary, fontSize: 11 }}
                        numberOfLines={1}>
                        {feedPreview.link || feedPreview.url}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <FeedArticlePreviews articles={feedPreview.articles ?? []} />
              </>
            )}
          </>
        )}

        {/* ── NEWSLETTER MODE ── */}
        {mode === 'newsletter' && isSelfHosted && (
          <View className="mt-3 flex-1 items-center justify-center px-6 py-12">
            <LetterOpenedIcon size={32} color={colors.grey} strokeWidth={1.8} />
            <Text
              fontFamily="geist-semibold"
              className="mt-4 text-center text-black dark:text-white"
              style={{ fontSize: 15 }}>
              Newsletters not supported on self-host
            </Text>
            <Text
              fontFamily="geist"
              className="text-grey dark:text-grey mt-2 text-center"
              style={{ fontSize: 13, lineHeight: 18 }}>
              Newsletter ingestion requires the hosted Readspace inbound email service, which
              isn&apos;t available on self-hosted instances.
            </Text>
          </View>
        )}

        {mode === 'newsletter' && !isSelfHosted && (
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
                          <CheckCircleIcon size={16} color={colors.secondary} />
                        ) : (
                          <CopyIcon size={16} color={isDark ? colors.grey2 : colors.grey} />
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
