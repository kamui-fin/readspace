import { Button } from '@components/ui/button';
import { EmptyState } from '@components/ui/empty-state';
import { CalendarIcon, DangerTriangleIcon, StarsIcon } from '@solar-icons/react-native/bold';
import { View } from 'react-native';

interface ActionProps {
  onGenerate?: () => void;
  isGenerating?: boolean;
}

/** No digest has ever been requested. */
export function CodexEmptyState({ onGenerate, isGenerating }: ActionProps) {
  return (
    <View className="flex-1 justify-center">
      <EmptyState
        variant="centered"
        icon={StarsIcon}
        title="Your Daily Digest is ready to build"
        description="One synthesised read of everything your sources covered in the last 24 hours — the developments worth knowing, strongest write-up first."
        actionButton={
          onGenerate ? (
            <Button variant="primary" size="medium" onPress={onGenerate} disabled={isGenerating}>
              {isGenerating ? 'Starting…' : "Build today's Digest"}
            </Button>
          ) : undefined
        }
      />
    </View>
  );
}

/** SKIPPED — zero candidate articles in the window. */
export function CodexQuietDayState({ onGenerate, isGenerating }: ActionProps) {
  return (
    <View className="flex-1 justify-center">
      <EmptyState
        variant="centered"
        icon={CalendarIcon}
        title="A quiet 24 hours"
        description="Nothing new came through your sources in the last day, so there's no digest to build. Check back tomorrow."
        actionButton={
          onGenerate ? (
            <Button variant="secondary" size="medium" onPress={onGenerate} disabled={isGenerating}>
              Try again
            </Button>
          ) : undefined
        }
      />
    </View>
  );
}

/** FAILED — generation errored. The allowance was not consumed. */
export function CodexFailedState({ onGenerate, isGenerating }: ActionProps) {
  return (
    <View className="flex-1 justify-center">
      <EmptyState
        variant="centered"
        icon={DangerTriangleIcon}
        title="Couldn't build your digest"
        description="Something went wrong while generating your Daily Digest. This didn't use up any of your allowance — give it another go."
        actionButton={
          onGenerate ? (
            <Button variant="primary" size="medium" onPress={onGenerate} disabled={isGenerating}>
              {isGenerating ? 'Starting…' : 'Try again'}
            </Button>
          ) : undefined
        }
      />
    </View>
  );
}

/** Quota exhausted or AI disabled — from the not-entitled 202 payload. */
export function CodexNotEntitledState({ reason }: { reason: string }) {
  return (
    <View className="flex-1 justify-center">
      <EmptyState
        variant="centered"
        icon={StarsIcon}
        title="No Daily Digest available right now"
        description={reason}
      />
    </View>
  );
}
