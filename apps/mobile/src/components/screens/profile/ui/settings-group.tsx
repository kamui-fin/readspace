import { Text } from '@components/ui/text';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { View } from 'react-native';

interface SettingsGroupProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function SettingsGroup({ title, children, className }: SettingsGroupProps) {
  return (
    <View className={clsx('gap-2', className)}>
      <Text size="md" fontFamily="geist-semibold" className="text-grey dark:text-grey">
        {title}
      </Text>
      <View className="overflow-hidden rounded-xl">{children}</View>
    </View>
  );
}
