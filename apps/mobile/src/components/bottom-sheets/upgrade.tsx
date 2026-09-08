import { Button } from '@components/ui/button';
import { Text } from '@components/ui/text';
import { useRevenueCat } from '@contexts/revenuecat-context';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import {
  Book2Icon,
  FeedIcon,
  MagicWandIcon,
  RocketIcon,
  SunIcon,
} from '@solar-icons/react-native/bold';
import { useUpgradeDialog } from '@stores/upgrade-dialog';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

// Custom X (Close) Icon SVG XML
const CLOSE_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 6L6 18M6 6l12 12"/></svg>`;

export function UpgradePaywallModal() {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const { isOpen, title, description, close } = useUpgradeDialog();
  const { currentOffering, purchasePackage, isLoading: isRcLoading } = useRevenueCat();

  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Find corresponding RevenueCat packages from fetched offerings
  const { monthlyPackage, yearlyPackage } = useMemo(() => {
    return {
      monthlyPackage: currentOffering?.monthly ?? null,
      yearlyPackage: currentOffering?.annual ?? null,
    };
  }, [currentOffering]);

  // Pricing display strings (with RevenueCat live price strings as source of truth, fallbacks for local dev)
  const monthlyPriceStr = monthlyPackage?.product.priceString ?? '$5.99';
  const yearlyPriceStr = yearlyPackage?.product.priceString ?? '$49.99';

  // Calculate yearly monthly-equivalent price ($49.99 / 12 = $4.17)
  const yearlyMonthlyEquivalentStr = useMemo(() => {
    if (yearlyPackage?.product.price) {
      const perMonth = yearlyPackage.product.price / 12;
      return `${yearlyPackage.product.currencyCode === 'USD' ? '$' : ''}${perMonth.toFixed(2)}`;
    }
    return '$4.17';
  }, [yearlyPackage]);

  const displayDescription =
    description !==
    'Unlock unlimited access to all features, including AI summaries and unlimited feed subscriptions.'
      ? description
      : null;

  const handlePurchase = async () => {
    const pkgToBuy = selectedPlan === 'monthly' ? monthlyPackage : yearlyPackage;

    if (!pkgToBuy) {
      console.log(
        '[UpgradePaywallModal] No active RevenueCat package loaded. Simulating purchase...'
      );
      setIsPurchasing(true);
      setTimeout(() => {
        setIsPurchasing(false);
        close();
      }, 1500);
      return;
    }

    setIsPurchasing(true);
    try {
      const success = await purchasePackage(pkgToBuy);
      if (success) {
        close();
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="overFullScreen"
      transparent={false}
      onRequestClose={close}>
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        {/* Floating Close Button */}
        <View className="absolute right-6 z-30" style={{ top: insets.top + 10 }}>
          <Pressable
            onPress={close}
            className="rounded-full p-2.5 active:opacity-60"
            style={{ backgroundColor: colors.grey6, borderWidth: 1, borderColor: colors.grey5 }}
            accessibilityLabel="Close Upgrade Screen"
            accessibilityRole="button">
            <SvgXml xml={CLOSE_XML} width={20} height={20} color={colors.black} />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{
            paddingTop: insets.top + (Platform.OS === 'ios' ? 24 : 16),
            paddingBottom: insets.bottom + 40,
          }}
          showsVerticalScrollIndicator={false}>
          {/* Header section */}
          <View className="mb-6 mt-4">
            <Text size="3xl" fontFamily="geist-bold" style={{ color: colors.black }}>
              {title}
            </Text>
          </View>

          {/* Features / Benefits list matching Web dialog - Standard spacious layout */}
          <View className="mb-8 rounded-3xl p-6" style={{ backgroundColor: colors.grey6 }}>
            <Text
              size="xs"
              fontFamily="geist-semibold"
              className="mb-5 uppercase tracking-wider"
              style={{ color: colors.grey }}>
              Benefits
            </Text>

            <View className="gap-6">
              {/* Benefit 1: Morning digest */}
              <View className="flex-row items-start">
                <View
                  className="mr-3.5 h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: isDark ? 'rgb(46, 46, 46)' : '#ffffff' }}>
                  <SunIcon size={20} color={colors.primary} />
                </View>
                <View className="flex-1 justify-center">
                  <Text size="base" fontFamily="geist-semibold" style={{ color: colors.black }}>
                    Your day, in one read
                  </Text>
                  <Text
                    size="xs"
                    fontFamily="geist"
                    className="mt-0.5"
                    style={{ color: colors.grey }}>
                    One morning digest. Everything that matters, nothing to scroll.
                  </Text>
                </View>
              </View>

              {/* Benefit 2: Unlimited feeds & newsletters */}
              <View className="flex-row items-start">
                <View
                  className="mr-3.5 h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: isDark ? 'rgb(46, 46, 46)' : '#ffffff' }}>
                  <FeedIcon size={20} color={colors.primary} />
                </View>
                <View className="flex-1 justify-center">
                  <Text size="base" fontFamily="geist-semibold" style={{ color: colors.black }}>
                    Unlimited feeds & newsletters
                  </Text>
                  <Text
                    size="xs"
                    fontFamily="geist"
                    className="mt-0.5"
                    style={{ color: colors.grey }}>
                    No caps. Newsletters land right in your feed.
                  </Text>
                </View>
              </View>

              {/* Benefit 3: AI that reads ahead */}
              <View className="flex-row items-start">
                <View
                  className="mr-3.5 h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: isDark ? 'rgb(46, 46, 46)' : '#ffffff' }}>
                  <MagicWandIcon size={20} color={colors.primary} />
                </View>
                <View className="flex-1 justify-center">
                  <Text size="base" fontFamily="geist-semibold" style={{ color: colors.black }}>
                    AI that reads ahead
                  </Text>
                  <Text
                    size="xs"
                    fontFamily="geist"
                    className="mt-0.5"
                    style={{ color: colors.grey }}>
                    Unlimited summaries, translations, key sentences highlighted.
                  </Text>
                </View>
              </View>

              {/* Benefit 4: Full articles, saved forever */}
              <View className="flex-row items-start">
                <View
                  className="mr-3.5 h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: isDark ? 'rgb(46, 46, 46)' : '#ffffff' }}>
                  <Book2Icon size={20} color={colors.primary} />
                </View>
                <View className="flex-1 justify-center">
                  <Text size="base" fontFamily="geist-semibold" style={{ color: colors.black }}>
                    Full articles, saved forever
                  </Text>
                  <Text
                    size="xs"
                    fontFamily="geist"
                    className="mt-0.5"
                    style={{ color: colors.grey }}>
                    Full text from the original website. Saved articles never expire.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Plans Selection */}
          <View className="mb-8">
            <Text
              size="base"
              fontFamily="geist-semibold"
              className="mb-4"
              style={{ color: colors.black }}>
              Choose your plan
            </Text>

            <View className="flex-row gap-4">
              {/* Monthly Card */}
              <Pressable
                onPress={() => setSelectedPlan('monthly')}
                className="flex-1 rounded-3xl border-2 p-4"
                style={{
                  borderColor: selectedPlan === 'monthly' ? colors.primary : colors.grey5,
                  backgroundColor:
                    selectedPlan === 'monthly'
                      ? isDark
                        ? 'rgba(46, 196, 182, 0.08)'
                        : 'rgba(46, 196, 182, 0.04)'
                      : 'transparent',
                }}>
                <Text size="base" fontFamily="geist-bold" style={{ color: colors.black }}>
                  Pro Monthly
                </Text>
                <Text
                  size="xs"
                  fontFamily="geist"
                  className="mt-0.5"
                  style={{ color: colors.grey }}>
                  Billed monthly
                </Text>
                <View className="mt-5 flex-row items-baseline">
                  <Text size="2xl" fontFamily="geist-bold" style={{ color: colors.black }}>
                    {monthlyPriceStr}
                  </Text>
                  <Text size="xs" fontFamily="geist" style={{ color: colors.grey }}>
                    /mo
                  </Text>
                </View>
              </Pressable>

              {/* Yearly Card */}
              <Pressable
                onPress={() => setSelectedPlan('yearly')}
                className="relative flex-1 rounded-3xl border-2 p-4"
                style={{
                  borderColor: selectedPlan === 'yearly' ? colors.primary : colors.grey5,
                  backgroundColor:
                    selectedPlan === 'yearly'
                      ? isDark
                        ? 'rgba(46, 196, 182, 0.08)'
                        : 'rgba(46, 196, 182, 0.04)'
                      : 'transparent',
                }}>
                {/* Promo Badge */}
                <View
                  className="shadow-xs absolute -top-3 left-4 right-4 items-center justify-center rounded-full py-0.5"
                  style={{ backgroundColor: colors.primary }}>
                  <Text
                    size="xs"
                    fontFamily="geist-bold"
                    className="text-[9px] uppercase tracking-wider text-white">
                    Save 30%
                  </Text>
                </View>

                <Text
                  size="base"
                  fontFamily="geist-bold"
                  className="mt-1"
                  style={{ color: colors.black }}>
                  Pro Yearly
                </Text>
                <Text
                  size="xs"
                  fontFamily="geist"
                  className="mt-0.5"
                  style={{ color: colors.grey }}>
                  Billed annually
                </Text>
                <View className="mt-5 flex-row items-baseline">
                  <Text size="2xl" fontFamily="geist-bold" style={{ color: colors.black }}>
                    {yearlyMonthlyEquivalentStr}
                  </Text>
                  <Text size="xs" fontFamily="geist" style={{ color: colors.grey }}>
                    /mo
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          {/* CTA Action Button */}
          <View className="mt-2">
            <Button variant="primary" size="large" disabled={isPurchasing} onPress={handlePurchase}>
              {isPurchasing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <View className="flex-row items-center justify-center gap-2">
                  <RocketIcon size={18} color="#ffffff" />
                  <Text className="font-geist-semibold text-white">Upgrade to Pro</Text>
                </View>
              )}
            </Button>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
