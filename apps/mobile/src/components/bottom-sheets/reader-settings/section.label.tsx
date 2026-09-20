import { Text } from '@components/ui/text';
import type { ReactNode } from 'react';
import { View } from 'react-native';

interface SectionProps {
  title: string;
  children: ReactNode;
}

/** A small grey label over its content — the spacing rhythm for the whole sheet. */
export function Section({ title, children }: SectionProps) {
  return (
    <View className="gap-2.5">
      <Text size={13} fontFamily="geist-medium" className="text-grey dark:text-grey px-1">
        {title}
      </Text>
      {children}
    </View>
  );
}
