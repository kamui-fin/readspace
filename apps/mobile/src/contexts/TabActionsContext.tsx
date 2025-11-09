import { createContext, useContext, type ReactNode } from 'react';

interface TabActionsContextType {
    registerTodayScrollToTop: (callback: () => void) => void;
    registerDiscoverFocusSearch: (callback: () => void) => void;
    registerExitPreviewToToday: (callback: () => void) => void;
    triggerTodayScrollToTop: () => void;
    triggerDiscoverFocusSearch: () => void;
    triggerExitPreviewToToday: () => void;
}

const TabActionsContext = createContext<TabActionsContextType | undefined>(undefined);

export function TabActionsProvider({ children }: { children: ReactNode }) {
    let todayScrollToTopCallback: (() => void) | null = null;
    let discoverFocusSearchCallback: (() => void) | null = null;
    let exitPreviewToTodayCallback: (() => void) | null = null;

    const registerTodayScrollToTop = (callback: () => void) => {
        todayScrollToTopCallback = callback;
    };

    const registerDiscoverFocusSearch = (callback: () => void) => {
        discoverFocusSearchCallback = callback;
    };

    const registerExitPreviewToToday = (callback: () => void) => {
        exitPreviewToTodayCallback = callback;
    };

    const triggerTodayScrollToTop = () => {
        todayScrollToTopCallback?.();
    };

    const triggerDiscoverFocusSearch = () => {
        discoverFocusSearchCallback?.();
    };

    const triggerExitPreviewToToday = () => {
        exitPreviewToTodayCallback?.();
    };

    return (
        <TabActionsContext.Provider
            value={{
                registerTodayScrollToTop,
                registerDiscoverFocusSearch,
                registerExitPreviewToToday,
                triggerTodayScrollToTop,
                triggerDiscoverFocusSearch,
                triggerExitPreviewToToday,
            }}>
            {children}
        </TabActionsContext.Provider>
    );
}

export function useTabActions() {
    const context = useContext(TabActionsContext);
    if (!context) {
        throw new Error('useTabActions must be used within TabActionsProvider');
    }
    return context;
}
