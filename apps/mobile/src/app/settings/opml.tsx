import { SettingsGroup, SettingsItem } from '@/components/SettingsGroup';
import { Monicon } from '@monicon/native';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

export default function OpmlSettingsScreen() {
  const router = useRouter();

  const handleImport = () => {
    toast('Import OPML');
  };

  const handleExport = () => {
    toast('Export OPML');
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center gap-4 px-6 pb-6">
          <Pressable
            onPress={() => router.back()}
            className="transition-opacity active:opacity-80">
            <Monicon name="lucide:chevron-left" size={24} color="#232222" />
          </Pressable>
          <Text className="font-geist-bold text-2xl tracking-heading text-black">OPML</Text>
        </View>

        {/* Content */}
        <View className="px-6">
          <SettingsGroup title="OPML">
            <SettingsItem label="Import" variant="button" onPress={handleImport} />
            <SettingsItem label="Export" variant="button" onPress={handleExport} isLast />
          </SettingsGroup>
        </View>
      </View>
    </SafeAreaView>
  );
}
