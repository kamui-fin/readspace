import SolarShieldKeyholeMinimalisticLinearIcon from '@components/icons/solar/shield-keyhole-minimalistic-linear';
import { Button } from '@components/ui/button';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { supabase } from '@lib/supabase/client';
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface VerificationStepProps {
  email: string;
  isActive: boolean;
}

export function VerificationStep({ email, isActive }: VerificationStepProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
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

  const handlePressContainer = () => {
    inputRef.current?.focus();
  };

  // Render individual slots for the OTP code display inside a single container with vertical dividers
  const renderOtpSlots = () => {
    const slots = [];
    for (let i = 0; i < 6; i++) {
      const char = i < code.length ? code[i] : '';

      slots.push(
        <View key={`slot-${i}`} className="flex-1 items-center justify-center">
          <Text
            size="2xl"
            fontFamily="geist-bold"
            className="text-primary_foreground"
            style={{ color: colors.primary_foreground }}>
            {char}
          </Text>
        </View>
      );

      if (i < 5) {
        slots.push(
          <View
            key={`divider-${i}`}
            style={{
              width: 1,
              height: 32,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
            }}
          />
        );
      }
    }
    return slots;
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'space-between',
            paddingBottom: Math.max(insets.bottom + 16, 24),
          }}
          keyboardShouldPersistTaps="handled">
          {/* Top Content */}
          <View className="pt-4 px-6">
            {/* Icon with Circle Wrapper */}
            <View
              className="mb-6 h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.grey6 }}>
              <SolarShieldKeyholeMinimalisticLinearIcon
                width={26}
                height={26}
                color={isDark ? colors.secondary : colors.primary}
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
              className="mb-6"
              style={{ color: colors.secondary }}>
              {email}
            </Text>

            {/* OTP Code Container (Single block with dividers) */}
            <Pressable
              onPress={handlePressContainer}
              className="h-16 w-full flex-row items-center rounded-2xl"
              style={{
                backgroundColor: colors.grey6,
                borderWidth: 1.5,
                borderColor: isFocused ? colors.primary : 'transparent',
              }}>
              {renderOtpSlots()}

              {/* Hidden Input field */}
              <TextInput
                ref={inputRef}
                value={code}
                onChangeText={(val) => setCode(val.replace(/[^0-9]/g, '').slice(0, 6))}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                keyboardType="number-pad"
                maxLength={6}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                }}
              />
            </Pressable>

            {/* Resend Code Link (Left aligned, primary brand color) */}
            <TouchableOpacity
              onPress={handleResendCode}
              disabled={resendCooldown > 0 || isLoading}
              activeOpacity={0.7}
              className="self-start mt-6 mb-4">
              <Text
                size="base"
                fontFamily="geist-semibold"
                className="text-left"
                style={{ color: colors.secondary }}>
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Floating Next Button at Bottom */}
          <View className="px-6 mb-2">
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
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
