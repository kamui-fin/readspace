import { Text } from '@components/ui/text';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface StepShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
}

/**
 * One page of the plan-change flow, laid out like the onboarding steps: heading block, content,
 * then a pinned full-width footer. The shared Stepper owns the header (back button, progress)
 * and the top spacing, so this only fills the page body.
 */
export function StepShell({ title, subtitle, children, footer }: StepShellProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 px-6">
      <View className="mb-8">
        <Text
          size="3xl"
          fontFamily="geist-bold"
          className="mb-2 text-primary_foreground dark:text-primary_foreground">
          {title}
        </Text>
        {subtitle && (
          <Text size="lg" fontFamily="geist-regular" className="text-grey dark:text-grey">
            {subtitle}
          </Text>
        )}
      </View>

      <View className="flex-1">{children}</View>

      <View
        className="mt-auto gap-3 pt-4"
        style={{ paddingBottom: Math.max(insets.bottom + 16, 24) }}>
        {footer}
      </View>
    </View>
  );
}
