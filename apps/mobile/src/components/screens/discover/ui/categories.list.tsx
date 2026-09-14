import { Chip } from '@components/ui/chip';
import { Text } from '@components/ui/text';
import { MOBILE_CATEGORY_NAMES } from '@readspace/shared';
import { Pressable, ScrollView, View } from 'react-native';

interface CategoriesListProps {
  selectedCategory: string | null;
  categoriesRow1: string[];
  categoriesRow2: string[];
  onCategoryPress: (category: string) => void;
  onClearCategory: () => void;
  categoryScrollRef: React.RefObject<ScrollView | null>;
}

export function CategoriesList({
  selectedCategory,
  categoriesRow1,
  categoriesRow2,
  onCategoryPress,
  onClearCategory,
  categoryScrollRef,
}: CategoriesListProps) {
  return (
    <View>
      <View className="mb-4 flex-row items-center justify-between px-6">
        <Text size="base" fontFamily="geist-semibold" className="text-black">
          Categories
        </Text>
        {selectedCategory && (
          <Pressable onPress={onClearCategory} className="transition-opacity active:opacity-60">
            <Text size="sm" fontFamily="geist-medium" className="text-secondary">
              Clear
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={categoryScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        className="pl-6">
        <View className="gap-2 pr-6">
          <View className="flex-row gap-2">
            {categoriesRow1.map((categoryId) => (
              <Chip
                key={categoryId}
                label={MOBILE_CATEGORY_NAMES[categoryId as keyof typeof MOBILE_CATEGORY_NAMES]}
                selected={selectedCategory === categoryId}
                onPress={() => onCategoryPress(categoryId)}
                size="category"
              />
            ))}
          </View>
          <View className="flex-row gap-2">
            {categoriesRow2.map((categoryId) => (
              <Chip
                key={categoryId}
                label={MOBILE_CATEGORY_NAMES[categoryId as keyof typeof MOBILE_CATEGORY_NAMES]}
                selected={selectedCategory === categoryId}
                onPress={() => onCategoryPress(categoryId)}
                size="category"
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
