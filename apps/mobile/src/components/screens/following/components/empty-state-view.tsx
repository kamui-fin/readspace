import { ArticleCardSkeletonList } from '@components/screens/following/ui/article-card.skeleton';
import { RefreshControl, ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/ui/empty-state';

import {
  DEFAULT_EMPTY_STATE_CONFIG,
  EMPTY_STATE_CONFIGS,
  type EmptyStateConfig,
} from '../../../../lib/constants/empty-states';

interface EmptyStateViewProps {
  isLoading: boolean;
  activeTab: number;
  refreshing: boolean;
  onRefresh: () => void;
  refreshColor: string;
}

export function EmptyStateView({
  isLoading,
  activeTab,
  refreshing,
  onRefresh,
  refreshColor,
}: EmptyStateViewProps) {
  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          minHeight: 400,
        }}>
        <ArticleCardSkeletonList count={8} />
      </View>
    );
  }

  const config: EmptyStateConfig =
    EMPTY_STATE_CONFIGS[activeTab as keyof typeof EMPTY_STATE_CONFIGS] ||
    DEFAULT_EMPTY_STATE_CONFIG;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        flexGrow: 1,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={refreshColor}
          colors={[refreshColor]}
        />
      }
      showsVerticalScrollIndicator={false}>
      <EmptyState variant="centered" icon={config.icon} message={config.message} />
    </ScrollView>
  );
}
