import clsx from 'clsx';
import { Text, View } from 'react-native';
import type { ReactNode } from 'react';

interface SettingsGroupProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function SettingsGroup({ title, children, className }: SettingsGroupProps) {
  return (
    <View className={clsx('gap-2', className)}>
      <Text className="font-geist-semibold text-sm text-grey dark:text-grey">{title}</Text>
      <View className="overflow-hidden rounded-xl">{children}</View>
    </View>
  );
}
