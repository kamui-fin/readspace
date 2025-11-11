import { Stack } from 'expo-router';

export default function AuthLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
            }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login/step-1" />
            <Stack.Screen name="login/step-2" />
            <Stack.Screen name="signup/step-1" />
            <Stack.Screen name="signup/step-2" />
            <Stack.Screen name="signup/step-3" />
        </Stack>
    );
}
