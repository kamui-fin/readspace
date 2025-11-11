import { Stack } from 'expo-router';

export default function OnboardingLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
            }}>
            <Stack.Screen name="feeds/categories" />
            <Stack.Screen name="feeds/recommendations" />
        </Stack>
    );
}
