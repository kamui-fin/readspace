import { View } from 'react-native';
import { Text } from '@components/ui/text';

export default function RecentsRoute() {
  return (
    <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
      <Text size="lg" fontFamily="geist-semibold" className="text-black dark:text-black-dark">
        Recents
      </Text>
      <Text
        size="base"
        fontFamily="geist"
        className="mt-2 text-center text-grey dark:text-grey-dark">
        Recent articles will appear here
      </Text>
    </View>
  );
}
