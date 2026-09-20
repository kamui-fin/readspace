import { SearchModeToggle } from '@components/screens/discover/ui/search-mode.toggle';
import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { Chip } from '@components/ui/chip';
import { Text } from '@components/ui/text';
import type { SheetRef } from '@components/ui/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { CONTENT_TYPE_DISPLAY_NAMES, ContentType } from '@readspace/shared';
import {
  BookIcon,
  BookmarkIcon,
  BuildingsIcon,
  CartIcon,
  CodeIcon,
  DocumentTextIcon,
  HeadphonesRoundIcon,
  LayersMinimalisticIcon,
  LetterIcon,
  PenIcon,
  PulseIcon,
  ScaleIcon,
  SquareAcademicCapIcon,
  UsersGroupRoundedIcon,
  VideocameraIcon,
} from '@solar-icons/react-native/linear';
import type { DiscoverSearchMode } from '@stores/discover-preferences';
import { type ComponentType, forwardRef, useCallback, useRef } from 'react';
import { Pressable, View } from 'react-native';

export interface ContentTypeOption {
  value: string;
  count: number;
  isRefined: boolean;
}

interface SearchOptionsSheetProps {
  searchMode: DiscoverSearchMode;
  onSearchModeChange: (mode: DiscoverSearchMode) => void;
  options: ContentTypeOption[];
  onToggle: (contentType: string) => void;
  onReset: () => void;
  canReset: boolean;
  onDismiss?: () => void;
}

type SolarIcon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const CONTENT_TYPE_ICONS: Record<ContentType, SolarIcon> = {
  [ContentType.NEWSLETTER]: LetterIcon,
  [ContentType.PODCAST_FEED]: HeadphonesRoundIcon,
  [ContentType.INDIE_BLOG]: PenIcon,
  [ContentType.NEWS_OUTLET]: DocumentTextIcon,
  [ContentType.MAGAZINE_EDITORIAL]: BookmarkIcon,
  [ContentType.VIDEO_CHANNEL]: VideocameraIcon,
  [ContentType.FORUM_COMMUNITY]: UsersGroupRoundedIcon,
  [ContentType.AGGREGATOR]: LayersMinimalisticIcon,
  [ContentType.CORPORATE_BLOG]: BuildingsIcon,
  [ContentType.DOCUMENTATION_WIKI]: BookIcon,
  [ContentType.EDUCATION_RESEARCH]: SquareAcademicCapIcon,
  [ContentType.OPEN_SOURCE_ACTIVITY]: CodeIcon,
  [ContentType.GOVERNMENT_INSTITUTIONAL]: ScaleIcon,
  [ContentType.MARKETPLACE_LISTINGS]: CartIcon,
  [ContentType.STATUS_CHANGELOG]: PulseIcon,
};

const SEARCH_MODE_HINTS: Record<DiscoverSearchMode, string> = {
  keywords: 'Matches the words you type. Best when you know what a feed is called.',
  smart: 'Finds feeds by meaning, so you can describe what you want to read.',
};

/**
 * Search options: how to search, and what to search across.
 *
 * Everything applies immediately to the results underneath rather than waiting
 * on a confirm, so the footer button only dismisses — a sheet that staged its
 * changes would need a cancel path and would hide the very results the choice
 * is meant to shape.
 */
export const SearchOptionsSheet = forwardRef<SheetRef, SearchOptionsSheetProps>(
  ({ searchMode, onSearchModeChange, options, onToggle, onReset, canReset, onDismiss }, ref) => {
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];

    // Own the instance rather than reading it back off `ref`, which may be a
    // callback ref the footer can't dereference.
    const sheetRef = useRef<SheetRef>(null);
    const setRefs = useCallback(
      (instance: SheetRef | null) => {
        sheetRef.current = instance;
        if (typeof ref === 'function') ref(instance);
        else if (ref) ref.current = instance;
      },
      [ref]
    );

    return (
      <BottomSheet
        ref={setRefs}
        onDismiss={onDismiss}
        headerTitle="Search options"
        headerTitleAlign="left"
        snapPoints={['80%']}
        headerRight={
          <Pressable
            onPress={onReset}
            disabled={!canReset}
            hitSlop={8}
            className="active:opacity-60">
            <Text
              size="sm"
              fontFamily="geist-medium"
              style={{ color: canReset ? colors.secondary : colors.grey3 }}>
              Reset
            </Text>
          </Pressable>
        }
        footerActions={
          <Button variant="primary" size="large" onPress={() => sheetRef.current?.dismiss()}>
            Done
          </Button>
        }>
        <Text size="sm" fontFamily="geist-semibold" className="text-black mb-3">
          Search mode
        </Text>
        <SearchModeToggle mode={searchMode} onModeChange={onSearchModeChange} />
        <Text size="sm" className="text-grey mt-3 px-1" style={{ lineHeight: 20 }}>
          {SEARCH_MODE_HINTS[searchMode]}
        </Text>

        <View className="mt-8">
          <Text size="sm" fontFamily="geist-semibold" className="text-black mb-1">
            Content type
          </Text>
          <Text size="sm" className="text-grey mb-4" style={{ lineHeight: 20 }}>
            Show only certain kinds of feed. Leave all off to see everything.
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {options.map((option) => {
              const Icon = CONTENT_TYPE_ICONS[option.value as ContentType];
              const label = CONTENT_TYPE_DISPLAY_NAMES[option.value as ContentType] ?? option.value;

              return (
                <Chip
                  key={option.value}
                  label={label}
                  selected={option.isRefined}
                  onPress={() => onToggle(option.value)}
                  size="medium"
                  icon={
                    Icon ? (
                      <Icon
                        size={15}
                        strokeWidth={2}
                        color={option.isRefined ? COLORS.light.white : colors.grey}
                      />
                    ) : undefined
                  }
                />
              );
            })}
          </View>
        </View>

        {/* The footer floats over the scroll content, so the last chip row
            needs its own clearance rather than ending flush under the button. */}
        <View className="h-10" />
      </BottomSheet>
    );
  }
);

SearchOptionsSheet.displayName = 'SearchOptionsSheet';
