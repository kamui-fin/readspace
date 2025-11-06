import { FeedSwitcher, type FeedSwitcherRef } from '@/components/FeedSwitcher';
import { BottomNav } from '@/components/ui/BottomNav';
import { FolderPickerProvider } from '@/contexts/FolderPickerContext';
import { Tabs } from 'expo-router';
import { useCallback, useRef } from 'react';

export default function TabsLayout() {
    const feedSwitcherRef = useRef<FeedSwitcherRef>(null);

    const handleExplorePress = useCallback(() => {
        feedSwitcherRef.current?.present();
    }, []);

    return (
        <FolderPickerProvider>
            <Tabs
                tabBar={(props) => <BottomNav onExplorePress={handleExplorePress} />}
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
        </FolderPickerProvider>
    );
}
