import { cn } from '@/utils/cn';
import { forwardRef, type ReactNode } from 'react';
import { ScrollView, Text, View, type ViewProps } from 'react-native';
import { CircleIcon } from './ui/CircleIcon';
import { Stepper } from './ui/Stepper';

export interface OnboardingLayoutProps extends ViewProps {
  currentStep: number;
  totalSteps: number;
  icon: ReactNode;
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  className?: string;
}

export const OnboardingLayout = forwardRef<React.ElementRef<typeof View>, OnboardingLayoutProps>(
  ({ currentStep, totalSteps, icon, title, subtitle, children, className, ...props }, ref) => {
    return (
      <View ref={ref} className={cn('flex-1 bg-white', className)} {...props}>
        <View className="flex-1 justify-center px-6 py-16">
          {/* Stepper */}
          <Stepper totalSteps={totalSteps} currentStep={currentStep} className="mb-20" />

          {/* Icon */}
          <CircleIcon size="lg" className="mb-6">
            {icon}
          </CircleIcon>

          {/* Title */}
          <Text
            className="mb-2 font-geist-semibold text-3xl text-black"
            style={{ letterSpacing: -0.02 * 32 }}>
            {title}
          </Text>

          {/* Subtitle */}
          {typeof subtitle === 'string' ? (
            <Text className="mb-8 font-geist text-base text-grey">{subtitle}</Text>
          ) : (
            <View className="mb-8">{subtitle}</View>
          )}

          {/* Content */}
          {children}
        </View>
      </View>
    );
  }
);

OnboardingLayout.displayName = 'OnboardingLayout';
