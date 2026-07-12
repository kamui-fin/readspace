import { useState, useRef, useEffect } from 'react';
import {
  View,
  Keyboard,
  TouchableWithoutFeedback,
  TextInput,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { Text } from '@components/ui/text';
import { Button } from '@components/ui/button';
import { toast } from '@components/ui/toast';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SolarShieldKeyholeMinimalisticLinearIcon from '@components/icons/solar/shield-keyhole-minimalistic-linear';
import { supabase } from '@lib/supabase/client';
import { router } from 'expo-router';

interface VerificationStepProps {
  email: string;
  isActive: boolean;
}

export function VerificationStep({ email, isActive }: VerificationStepProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRef = useRef<TextInput>(null);

  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  // Focus input dynamically when step becomes active
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const handleVerify = async () => {
    if (code.trim().length !== 6) {
      toast.error('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'signup',
      });

      if (error) {
        throw error;
      }

      toast.success('Email verified successfully!');
      // Global onAuthStateChange listener in SessionProvider handles the session
      // creation and automatically redirects the authenticated user.
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(errorMsg || 'Invalid verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });

      if (error) throw error;

      toast.success('A new code has been sent to your email.');
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(errorMsg || 'Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Focus the hidden text input
  const handlePressContainer = () => {
    inputRef.current?.focus();
  };

  // Render individual slots for the OTP code display
  const renderOtpSlots = () => {
    const slots = [];
    for (let i = 0; i < 6; i++) {
      let char = '';
      let isCurrent = false;

      if (i < code.length) {
        char = code[i];
      } else if (i === code.length) {
        char = '—';
        isCurrent = true;
      }

      slots.push(
        <View key={i} className="w-10 items-center justify-center">
          <Text
            size="2xl"
            fontFamily="geist-bold"
            className={isCurrent ? 'text-grey' : 'text-primary_foreground'}
            style={{ color: isCurrent ? colors.grey : colors.primary_foreground }}>
            {char}
          </Text>
        </View>
      );
    }
    return slots;
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View
        className="flex-1 justify-between px-6"
        style={{ paddingBottom: Math.max(insets.bottom + 16, 24) }}>
        {/* Main Content */}
        <View className="pt-4">
          {/* Icon with Circle Wrapper */}
          <View
            className="mb-6 h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.grey6 }}>
            <SolarShieldKeyholeMinimalisticLinearIcon
              width={26}
              height={26}
              color={colors.primary}
            />
          </View>

          {/* Typography headers */}
          <Text
            size="3xl"
            fontFamily="geist-bold"
            className="text-primary_foreground mb-2"
            style={{ color: colors.primary_foreground }}>
            Verify your email
          </Text>

          <Text
            size="base"
            fontFamily="geist-regular"
            className="text-grey mb-1"
            style={{ color: colors.grey }}>
            We sent a verification code to your email
          </Text>

          <Text
            size="base"
            fontFamily="geist-semibold"
            className="text-primary_foreground mb-6"
            style={{ color: colors.primary_foreground }}>
            {email}
          </Text>

          {/* OTP Code Container */}
          <Pressable
            onPress={handlePressContainer}
            className="h-16 flex-row items-center justify-evenly rounded-2xl"
            style={{ backgroundColor: colors.grey6 }}>
            {renderOtpSlots()}

            {/* Hidden Input field */}
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={(val) => setCode(val.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                opacity: 0,
              }}
            />
          </Pressable>

          {/* Resend Code Link */}
          <TouchableOpacity
            onPress={handleResendCode}
            disabled={resendCooldown > 0 || isLoading}
            activeOpacity={0.7}
            className="align-self-center mt-6">
            <Text
              size="base"
              fontFamily="geist-semibold"
              className="text-primary text-center"
              style={{ color: colors.primary }}>
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
            </Text>
          </TouchableOpacity>

          {/* Back to Sign in Link */}
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            disabled={isLoading}
            activeOpacity={0.7}
            className="align-self-center mt-4">
            <Text
              size="base"
              fontFamily="geist-semibold"
              className="text-grey text-center underline"
              style={{ color: colors.grey }}>
              Back to Sign in
            </Text>
          </TouchableOpacity>
        </View>

        {/* Floating Next Button at Bottom */}
        <View className="mb-2">
          <Button
            variant="primary"
            size="large"
            loading={isLoading}
            disabled={code.length !== 6 || isLoading}
            onPress={handleVerify}
            style={{ borderRadius: 100 }}>
            Next
          </Button>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
