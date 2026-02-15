import { Stack } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="login/index"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="signup/index"
        options={{
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
}
