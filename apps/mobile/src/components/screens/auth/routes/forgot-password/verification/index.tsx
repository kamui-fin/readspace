import SolarShieldKeyholeMinimalisticLinearIcon from '@components/icons/solar/shield-keyhole-minimalistic-linear';
import { Button } from '@components/ui/button';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { supabase } from '@lib/supabase/client';
import { useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ForgotPasswordVerificationStepProps {
  email: string;
  onVerified: () => void;
}

export function ForgotPasswordVerificationStep({
  email,
  onVerified,
}: ForgotPasswordVerificationStepProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRef = useRef<TextInput>(null);

  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const handleVerify = async () => {
    if (code.trim().length !== 6) {
      toast.error('Please enter the 6-digit code.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'recovery',
      });

      if (error) {
        throw error;
      }

      onVerified();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(errorMsg || 'Invalid code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setIsLoading(true);
    try {
      const webUrl = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:18042';
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${webUrl}/auth/confirm`,
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
        <View className="pt-4">
          <View
            className="mb-6 h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.grey6 }}>
            <SolarShieldKeyholeMinimalisticLinearIcon
              width={26}
              height={26}
              color={colors.primary}
            />
          </View>

          <Text
            size="3xl"
            fontFamily="geist-bold"
            className="text-primary_foreground mb-2"
            style={{ color: colors.primary_foreground }}>
            Check your email
          </Text>

          <Text
            size="base"
            fontFamily="geist-regular"
            className="text-grey mb-1"
            style={{ color: colors.grey }}>
            We sent a reset code to
          </Text>

          <Text
            size="base"
            fontFamily="geist-semibold"
            className="text-primary_foreground mb-6"
            style={{ color: colors.primary_foreground }}>
            {email}
          </Text>

          <Pressable
            onPress={handlePressContainer}
            className="h-16 flex-row items-center justify-evenly rounded-2xl"
            style={{ backgroundColor: colors.grey6 }}>
            {renderOtpSlots()}

            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={(val) => setCode(val.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                opacity: 0,
              }}
            />
          </Pressable>

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
        </View>

        <View className="mb-2">
          <Button
            variant="primary"
            size="large"
            loading={isLoading}
            disabled={code.length !== 6 || isLoading}
            onPress={handleVerify}
            style={{ borderRadius: 100 }}>
            Continue
          </Button>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
