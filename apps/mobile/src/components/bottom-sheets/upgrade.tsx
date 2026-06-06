import SparkleIcon from '@components/icons/local/sparkle';
import RssIcon from '@components/icons/local/rss';
import ReadspaceLogoIcon from '@components/icons/local/readspace-logo';
import RocketBoldIcon from '@components/icons/solar/rocket-bold';
import { Button } from '@components/ui/button';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { useRevenueCat } from '@contexts/revenuecat-context';
import { useUpgradeDialog } from '@stores/upgrade-dialog';
import { COLORS } from '@lib/constants/colors';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View, ActivityIndicator, Modal, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

// Custom X (Close) Icon SVG XML
const CLOSE_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 6L6 18M6 6l12 12"/></svg>`;

// Custom Search/AI discovery Icon SVG XML
const SEARCH_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>`;

// Custom Book/Reading Library Icon SVG XML
const BOOK_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.03a6 6 0 00-6-2.25 6 6 0 00-6 2.25v13.5a6 6 0 016-2.25 6 6 0 016 2.25M12 6.03a6 6 0 016-2.25 6 6 0 016 2.25v13.5a6 6 0 00-6-2.25 6 6 0 00-6 2.25M12 6.03v13.5"/></svg>`;

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
  const monthlyPriceStr = monthlyPackage?.product.priceString ?? '$7.99';
  const yearlyPriceStr = yearlyPackage?.product.priceString ?? '$59.99';
  
  // Calculate yearly monthly-equivalent price ($59.99 / 12 = $4.99)
  const yearlyMonthlyEquivalentStr = useMemo(() => {
    if (yearlyPackage?.product.price) {
      const perMonth = yearlyPackage.product.price / 12;
      return `${yearlyPackage.product.currencyCode === 'USD' ? '$' : ''}${perMonth.toFixed(2)}`;
    }
    return '$4.99';
  }, [yearlyPackage]);

  // Make description text concise
  const displayDescription = useMemo(() => {
    const defaultDesc = 'Unlock unlimited access to all features, including AI summaries and unlimited feed subscriptions.';
    if (description === defaultDesc) {
      return 'Get unlimited feeds & daily AI summaries.';
    }
    return description;
  }, [description]);

  const handlePurchase = async () => {
    const pkgToBuy = selectedPlan === 'monthly' ? monthlyPackage : yearlyPackage;
    
    if (!pkgToBuy) {
      console.log('[UpgradePaywallModal] No active RevenueCat package loaded. Simulating purchase...');
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
            className="p-2.5 rounded-full active:opacity-60"
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
          
          {/* Header section with Readspace logo */}
          <View className="mb-6 mt-4 items-center">
            <View 
              className="h-14 w-14 rounded-full items-center justify-center mb-4" 
              style={{ backgroundColor: colors.primary + '18' }}>
              <ReadspaceLogoIcon width={34} height={34} />
            </View>
            <Text size="2xl" fontFamily="geist-bold" className="text-center" style={{ color: colors.black }}>
              {title}
            </Text>
            {displayDescription ? (
              <Text size="base" fontFamily="geist" className="text-center mt-2 px-4" style={{ color: colors.grey }}>
                {displayDescription}
              </Text>
            ) : null}
          </View>

          {/* Features / Benefits list matching Web dialog - Standard spacious layout */}
          <View className="mb-8 p-6 rounded-3xl" style={{ backgroundColor: colors.grey6 }}>
            <Text size="xs" fontFamily="geist-semibold" className="uppercase tracking-wider mb-5" style={{ color: colors.grey }}>
              Readspace Pro benefits
            </Text>
            
            <View className="gap-6">
              {/* Benefit 1: Feed capacity */}
              <View className="flex-row items-start">
                <View 
                  className="mr-3.5 h-9 w-9 rounded-full items-center justify-center" 
                  style={{ backgroundColor: isDark ? 'rgb(46, 46, 46)' : '#ffffff' }}>
                  <RssIcon width={18} height={18} color={colors.primary} />
                </View>
                <View className="flex-1 justify-center">
                  <Text size="base" fontFamily="geist-semibold" style={{ color: colors.black }}>
                    Up to 1000 feeds
                  </Text>
                  <Text size="xs" fontFamily="geist" className="mt-0.5" style={{ color: colors.grey }}>
                    Follow all your favorite creators, newsletters, & blogs.
                  </Text>
                </View>
              </View>

              {/* Benefit 2: AI Summaries */}
              <View className="flex-row items-start">
                <View 
                  className="mr-3.5 h-9 w-9 rounded-full items-center justify-center" 
                  style={{ backgroundColor: isDark ? 'rgb(46, 46, 46)' : '#ffffff' }}>
                  <SparkleIcon width={18} height={18} color={colors.primary} />
                </View>
                <View className="flex-1 justify-center">
                  <Text size="base" fontFamily="geist-semibold" style={{ color: colors.black }}>
                    100 AI reader tools / day
                  </Text>
                  <Text size="xs" fontFamily="geist" className="mt-0.5" style={{ color: colors.grey }}>
                    Summarize or translate long-form writing instantly.
                  </Text>
                </View>
              </View>

              {/* Benefit 3: Intelligent discovery */}
              <View className="flex-row items-start">
                <View 
                  className="mr-3.5 h-9 w-9 rounded-full items-center justify-center" 
                  style={{ backgroundColor: isDark ? 'rgb(46, 46, 46)' : '#ffffff' }}>
                  <SvgXml xml={SEARCH_XML} width={18} height={18} color={colors.primary} />
                </View>
                <View className="flex-1 justify-center">
                  <Text size="base" fontFamily="geist-semibold" style={{ color: colors.black }}>
                    Intelligent discovery
                  </Text>
                  <Text size="xs" fontFamily="geist" className="mt-0.5" style={{ color: colors.grey }}>
                    Search and filter articles using natural conversational AI.
                  </Text>
                </View>
              </View>

              {/* Benefit 4: Reading Library */}
              <View className="flex-row items-start">
                <View 
                  className="mr-3.5 h-9 w-9 rounded-full items-center justify-center" 
                  style={{ backgroundColor: isDark ? 'rgb(46, 46, 46)' : '#ffffff' }}>
                  <SvgXml xml={BOOK_XML} width={18} height={18} color={colors.primary} />
                </View>
                <View className="flex-1 justify-center">
                  <Text size="base" fontFamily="geist-semibold" style={{ color: colors.black }}>
                    Personal reading library
                  </Text>
                  <Text size="xs" fontFamily="geist" className="mt-0.5" style={{ color: colors.grey }}>
                    Keep bookmarks, highlights, and custom notes synced forever.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Plans Selection */}
          <View className="mb-8">
            <Text size="base" fontFamily="geist-semibold" className="mb-4" style={{ color: colors.black }}>
              Choose your plan
            </Text>

            <View className="flex-row gap-4">
              {/* Monthly Card */}
              <Pressable
                onPress={() => setSelectedPlan('monthly')}
                className="flex-1 p-4 rounded-3xl border-2"
                style={{
                  borderColor: selectedPlan === 'monthly' ? colors.primary : colors.grey5,
                  backgroundColor: selectedPlan === 'monthly' ? (isDark ? 'rgba(46, 196, 182, 0.08)' : 'rgba(46, 196, 182, 0.04)') : 'transparent',
                }}>
                <Text size="base" fontFamily="geist-bold" style={{ color: colors.black }}>
                  Pro Monthly
                </Text>
                <Text size="xs" fontFamily="geist" className="mt-0.5" style={{ color: colors.grey }}>
                  Billed monthly
                </Text>
                <View className="flex-row items-baseline mt-5">
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
                className="flex-1 p-4 rounded-3xl border-2 relative"
                style={{
                  borderColor: selectedPlan === 'yearly' ? colors.primary : colors.grey5,
                  backgroundColor: selectedPlan === 'yearly' ? (isDark ? 'rgba(46, 196, 182, 0.08)' : 'rgba(46, 196, 182, 0.04)') : 'transparent',
                }}>
                {/* Promo Badge */}
                <View
                  className="absolute -top-3 left-4 right-4 rounded-full py-0.5 items-center justify-center shadow-xs"
                  style={{ backgroundColor: colors.primary }}>
                  <Text size="xs" fontFamily="geist-bold" className="text-white text-[9px] uppercase tracking-wider">
                    Save 25%
                  </Text>
                </View>
                
                <Text size="base" fontFamily="geist-bold" className="mt-1" style={{ color: colors.black }}>
                  Pro Yearly
                </Text>
                <Text size="xs" fontFamily="geist" className="mt-0.5" style={{ color: colors.grey }}>
                  Billed annually
                </Text>
                <View className="flex-row items-baseline mt-5">
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
            <Button
              variant="primary"
              size="large"
              disabled={isPurchasing}
              onPress={handlePurchase}>
              {isPurchasing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <View className="flex-row items-center justify-center gap-2">
                  <RocketBoldIcon width={18} height={18} color="#ffffff" />
                  <Text className="text-white font-geist-semibold">Upgrade to Pro</Text>
                </View>
              )}
            </Button>
          </View>

        </ScrollView>
      </View>
    </Modal>
  );
}
