import { FeedSwitcher, type FeedSwitcherRef } from '@/components/FeedSwitcher';
import { BottomNav } from '@/components/ui/BottomNav';
import { FolderPickerProvider } from '@/contexts/FolderPickerContext';
import { TabActionsProvider, useTabActions } from '@/contexts/TabActionsContext';
import { Tabs } from 'expo-router';
import { useCallback, useRef } from 'react';

function TabsContent() {
    const feedSwitcherRef = useRef<FeedSwitcherRef>(null);
    const { triggerTodayScrollToTop, triggerDiscoverFocusSearch, triggerExitPreviewToToday } =
        useTabActions();

    const handleExplorePress = useCallback(() => {
        feedSwitcherRef.current?.present();
    }, []);

    const handleTodayPress = useCallback(() => {
        // First exit preview mode and return to Today tab
        triggerExitPreviewToToday();
        // Then scroll to top
        triggerTodayScrollToTop();
    }, [triggerExitPreviewToToday, triggerTodayScrollToTop]);

    const handleDiscoverFocusSearch = useCallback(() => {
        triggerDiscoverFocusSearch();
    }, [triggerDiscoverFocusSearch]);

    return (
        <>
            <Tabs
                tabBar={(props) => (
                    <BottomNav
                        onExplorePress={handleExplorePress}
                        onTodayPress={handleTodayPress}
                        onDiscoverFocusSearch={handleDiscoverFocusSearch}
                    />
                )}
                screenOptions={{
                    headerShown: false,
                }}>
                <Tabs.Screen
                    name="index"
                    options={{
                        title: 'Today',
                    }}
                />
                <Tabs.Screen
                    name="discover"
                    options={{
                        title: 'Discover',
                    }}
                />
                <Tabs.Screen
                    name="settings"
                    options={{
                        title: 'Settings',
                    }}
                />
            </Tabs>

            {/* Feed Switcher Bottom Sheet */}
            <FeedSwitcher ref={feedSwitcherRef} />
        </>
    );
}

export default function TabsLayout() {
    return (
        <FolderPickerProvider>
            <TabActionsProvider>
                <TabsContent />
            </TabActionsProvider>
        </FolderPickerProvider>
    );
}
