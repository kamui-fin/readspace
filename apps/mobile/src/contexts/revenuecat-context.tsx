import { useSession } from '@contexts/auth-context';
import { toast } from '@components/ui/toast';
import { supabase } from '@lib/supabase/client';
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Platform, NativeModules } from 'react-native';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

// Dynamically import Purchases core to prevent crashes in Expo Go or when native modules are not linked
let Purchases: any = null;
let PurchasesResolved = false;
let LOG_LEVEL = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

function getPurchases() {
  if (PurchasesResolved) return Purchases;
  PurchasesResolved = true;

  // Safe check for RNPurchases native module without using Object.keys()
  const hasNativeCoreModule = Boolean(NativeModules && NativeModules.RNPurchases);

  if (hasNativeCoreModule) {
    try {
      Purchases = require('react-native-purchases').default || require('react-native-purchases');
      const CoreExports = require('react-native-purchases');
      if (CoreExports.LOG_LEVEL) {
        LOG_LEVEL = CoreExports.LOG_LEVEL;
      }
      console.log('[RevenueCat] Purchases core native module loaded successfully.');
    } catch (e) {
      console.warn('[RevenueCat] Failed to load Purchases core native module:', e);
      Purchases = null;
    }
  } else {
    console.log(
      '[RevenueCat] Purchases core native module not detected. SDK running in mock mode.'
    );
  }
  return Purchases;
}

// Dynamically import RevenueCatUI to prevent crashes in Expo Go or when native modules are not linked
let RevenueCatUI: any = null;
let RevenueCatUIResolved = false;
let PAYWALL_RESULT = {
  PURCHASED: 'PURCHASED',
  RESTORED: 'RESTORED',
  CANCELLED: 'CANCELLED',
  ERROR: 'ERROR',
};

function getRevenueCatUI() {
  if (RevenueCatUIResolved) return RevenueCatUI;
  RevenueCatUIResolved = true;

  // Safe check for RNPaywalls native module without using Object.keys()
  const hasNativeUiModule = Boolean(NativeModules && NativeModules.RNPaywalls);

  if (hasNativeUiModule) {
    try {
      RevenueCatUI =
        require('react-native-purchases-ui').default || require('react-native-purchases-ui');
      const UIExports = require('react-native-purchases-ui');
      if (UIExports.PAYWALL_RESULT) {
        PAYWALL_RESULT = UIExports.PAYWALL_RESULT;
      }
      console.log('[RevenueCat] RevenueCat UI native module loaded successfully.');
    } catch (e) {
      console.warn('[RevenueCat] Failed to load RevenueCat UI native module:', e);
      RevenueCatUI = null;
    }
  } else {
    console.log(
      '[RevenueCat] Purchases UI native module not detected. UI shortcuts will use fallback.'
    );
  }
  return RevenueCatUI;
}

interface RevenueCatContextType {
  isPro: boolean;
  isRcPro: boolean;
  customerInfo: CustomerInfo | null;
  currentOffering: PurchasesOffering | null;
  isLoading: boolean;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  presentPaywall: (offering?: PurchasesOffering) => Promise<boolean>;
  presentPaywallIfNeeded: () => Promise<boolean>;
  presentCustomerCenter: () => Promise<void>;
  refetchCustomerInfo: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextType>({
  isPro: false,
  isRcPro: false,
  customerInfo: null,
  currentOffering: null,
  isLoading: true,
  purchasePackage: async () => false,
  restorePurchases: async () => false,
  presentPaywall: async () => false,
  presentPaywallIfNeeded: async () => false,
  presentCustomerCenter: async () => {},
  refetchCustomerInfo: async () => {},
});

export const useRevenueCat = () => useContext(RevenueCatContext);

interface RevenueCatProviderProps {
  children: React.ReactNode;
}

const REVENUECAT_API_KEY = 'test_cfHuzuhOXcYuSOZuLbNixiMXADV';
const ENTITLEMENT_ID = 'Readspace Pro';

export function RevenueCatProvider({ children }: RevenueCatProviderProps) {
  const { user, isLoading: isAuthLoading } = useSession();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);
  const [isRcPro, setIsRcPro] = useState(false);
  const [dbRole, setDbRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSdkReady, setIsSdkReady] = useState(false);

  const lastSyncedUserId = useRef<string | null | undefined>(undefined);
  const isConfiguring = useRef(false);

  const isDbPro = dbRole === 'PRO' || dbRole === 'ADMIN';
  const combinedIsPro = isRcPro || isDbPro;

  // Sync DB role from Supabase
  useEffect(() => {
    if (!user?.id || !isSdkReady) {
      setDbRole(null);
      return;
    }

    const fetchRole = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (!error && data) {
          console.log(`[RevenueCat] 👤 Fetched DB role: ${data.role}`);
          setDbRole(data.role);
        }
      } catch (err) {
        console.error('[RevenueCat] Failed to fetch database role:', err);
      }
    };
    fetchRole();
  }, [user?.id, isSdkReady]);

  // Initialize Purchases SDK
  useEffect(() => {
    if (isConfiguring.current) return;
    isConfiguring.current = true;

    const initializePurchases = async () => {
      try {
        const purchasesInstance = getPurchases();
        if (!purchasesInstance) {
          console.log(
            '[RevenueCat] Purchases core native module not available. SDK running in mock mode.'
          );
          setIsLoading(false);
          return;
        }
        console.log('[RevenueCat] 🚀 Initializing RevenueCat SDK...');
        purchasesInstance.setLogLevel(LOG_LEVEL.DEBUG);

        // Configure SDK
        purchasesInstance.configure({
          apiKey: REVENUECAT_API_KEY,
        });

        console.log('[RevenueCat] SDK Configured successfully.');
        setIsSdkReady(true);
        await loadCustomerInfoAndOfferings();
      } catch (error) {
        console.error('[RevenueCat] Initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializePurchases();

    // Listen for customer info updates (e.g. renewals, purchases from paywall)
    const listener = (info: CustomerInfo) => {
      console.log('[RevenueCat] 🔄 CustomerInfo updated via listener:', info);
      setCustomerInfo(info);
      checkEntitlements(info);
    };

    const purchasesInstance = getPurchases();
    if (purchasesInstance) {
      purchasesInstance.addCustomerInfoUpdateListener(listener);
    }

    return () => {
      const purchasesInstance = getPurchases();
      if (purchasesInstance) {
        purchasesInstance.removeCustomerInfoUpdateListener(listener);
      }
    };
  }, []);

  // Sync user with RevenueCat
  useEffect(() => {
    if (isAuthLoading || !isSdkReady) return;

    const syncUser = async () => {
      const purchasesInstance = getPurchases();
      if (!purchasesInstance) return;

      const currentUserId = user?.id || null;
      if (lastSyncedUserId.current === currentUserId) return;
      lastSyncedUserId.current = currentUserId;

      try {
        if (currentUserId) {
          console.log(`[RevenueCat] 👤 Logging in user: ${currentUserId}`);
          const { customerInfo: loggedInInfo } = await purchasesInstance.logIn(currentUserId);
          setCustomerInfo(loggedInInfo);
          checkEntitlements(loggedInInfo);
        } else {
          // Immediately reset status when logging out/anonymous to prevent Pro leak
          setIsRcPro(false);
          setCustomerInfo(null);

          const isAnon = await purchasesInstance.isAnonymous();
          if (!isAnon) {
            console.log('[RevenueCat] 👤 Logging out user (restoring anonymous state)');
            const loggedOutInfo = await purchasesInstance.logOut();
            setCustomerInfo(loggedOutInfo);
            checkEntitlements(loggedOutInfo);
          } else {
            console.log('[RevenueCat] 👤 User is already anonymous. Skipping logout.');
          }
        }
      } catch (error) {
        console.error('[RevenueCat] Error syncing user:', error);
        // Clear tracker ref so it can retry next run
        lastSyncedUserId.current = undefined;
      }
    };

    syncUser();
  }, [user?.id, isAuthLoading, isSdkReady]);

  const loadCustomerInfoAndOfferings = async () => {
    try {
      const purchasesInstance = getPurchases();
      if (!purchasesInstance) return;
      const info = await purchasesInstance.getCustomerInfo();
      setCustomerInfo(info);
      checkEntitlements(info);

      const retrievedOfferings = await purchasesInstance.getOfferings();
      if (retrievedOfferings.current) {
        console.log('[RevenueCat] Offering loaded:', retrievedOfferings.current.identifier);
        setCurrentOffering(retrievedOfferings.current);
      } else {
        console.log('[RevenueCat] No current offerings found.');
      }
    } catch (error) {
      console.error('[RevenueCat] Error loading info & offerings:', error);
    }
  };

  const checkEntitlements = (info: CustomerInfo) => {
    const active = info.entitlements.active[ENTITLEMENT_ID];
    const userIsPro = typeof active !== 'undefined';
    console.log(`[RevenueCat] 🛡️ Entitlement status: ${ENTITLEMENT_ID} active = ${userIsPro}`);
    setIsRcPro(userIsPro);
  };

  const refetchCustomerInfo = async () => {
    try {
      const purchasesInstance = getPurchases();
      if (!purchasesInstance) return;
      const info = await purchasesInstance.getCustomerInfo();
      setCustomerInfo(info);
      checkEntitlements(info);
    } catch (error) {
      console.error('[RevenueCat] Failed to refetch customer info:', error);
    }
  };

  const purchasePackage = async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      const purchasesInstance = getPurchases();
      if (!purchasesInstance) {
        console.log('[RevenueCat] Simulating mock purchase package...');
        toast.success('Subscription completed (mock)!');
        setIsRcPro(true);
        return true;
      }
      console.log(`[RevenueCat] 💳 Attempting to purchase package: ${pkg.product.identifier}`);
      const { customerInfo: updatedInfo } = await purchasesInstance.purchasePackage(pkg);
      setCustomerInfo(updatedInfo);
      checkEntitlements(updatedInfo);
      toast.success('Subscription completed successfully!');
      return true;
    } catch (error: any) {
      if (error.userCancelled) {
        console.log('[RevenueCat] Purchase cancelled by user.');
      } else {
        console.error('[RevenueCat] Purchase error:', error);
        toast.error(error.message || 'An error occurred during purchase.');
      }
      return false;
    }
  };

  const restorePurchases = async (): Promise<boolean> => {
    try {
      const purchasesInstance = getPurchases();
      if (!purchasesInstance) {
        console.log('[RevenueCat] Simulating mock restore purchases...');
        toast.success('Restoration complete (mock).');
        return false;
      }
      console.log('[RevenueCat] 🔄 Restoring purchases...');
      const info = await purchasesInstance.restorePurchases();
      setCustomerInfo(info);
      checkEntitlements(info);
      const isUserPro = typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
      if (isUserPro) {
        toast.success('Purchases restored. Premium access unlocked!');
      } else {
        toast.success('Restoration complete. No active subscriptions found.');
      }
      return isUserPro;
    } catch (error: any) {
      console.error('[RevenueCat] Restore error:', error);
      toast.error(error.message || 'Failed to restore purchases.');
      return false;
    }
  };

  const presentPaywall = async (offering?: PurchasesOffering): Promise<boolean> => {
    try {
      const uiInstance = getRevenueCatUI();
      if (!uiInstance) {
        console.log(
          '[RevenueCat] Paywall UI not available in this environment. Showing custom bottom sheet...'
        );
        const { useUpgradeDialog } = require('@stores/upgrade-dialog');
        useUpgradeDialog.getState().open();
        return false;
      }
      console.log('[RevenueCat] 📺 Presenting paywall...');
      const result = await uiInstance.presentPaywall(offering ? { offering } : undefined);

      console.log('[RevenueCat] Paywall closed with result:', result);

      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        await refetchCustomerInfo();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[RevenueCat] Failed to present paywall:', error);
      return false;
    }
  };

  const presentPaywallIfNeeded = async (): Promise<boolean> => {
    try {
      const uiInstance = getRevenueCatUI();
      if (!uiInstance) {
        console.log(
          '[RevenueCat] Paywall UI not available in this environment. Showing custom bottom sheet...'
        );
        const { useUpgradeDialog } = require('@stores/upgrade-dialog');
        useUpgradeDialog.getState().open();
        return false;
      }
      console.log('[RevenueCat] Checking if paywall needed...');
      const result = await uiInstance.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: ENTITLEMENT_ID,
      });

      console.log('[RevenueCat] presentPaywallIfNeeded result:', result);

      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        await refetchCustomerInfo();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[RevenueCat] Failed to present paywall if needed:', error);
      return false;
    }
  };

  const presentCustomerCenter = async () => {
    try {
      const uiInstance = getRevenueCatUI();
      if (!uiInstance) {
        toast.error('Subscription management is only available on built devices.');
        return;
      }
      console.log('[RevenueCat] ⚙️ Presenting Customer Center...');
      await uiInstance.presentCustomerCenter();
    } catch (error) {
      console.error('[RevenueCat] Failed to present Customer Center:', error);
      toast.error('Could not load subscription details.');
    }
  };

  return (
    <RevenueCatContext.Provider
      value={{
        isPro: combinedIsPro,
        isRcPro,
        customerInfo,
        currentOffering,
        isLoading,
        purchasePackage,
        restorePurchases,
        presentPaywall,
        presentPaywallIfNeeded,
        presentCustomerCenter,
        refetchCustomerInfo,
      }}>
      {children}
    </RevenueCatContext.Provider>
  );
}
