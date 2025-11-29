import { Chip } from "@components/ui/chip";
import { Text } from "@components/ui/text";
import { Pressable, ScrollView, View } from "react-native";

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
                <Text
                    size="base"
                    fontFamily="geist-semibold"
                    className="text-black"
                >
                    Categories
                </Text>
                {selectedCategory && (
                    <Pressable
                        onPress={onClearCategory}
                        className="transition-opacity active:opacity-60"
                    >
                        <Text
                            size="sm"
                            fontFamily="geist-medium"
                            className="text-secondary"
                        >
                            Clear
                        </Text>
                    </Pressable>
                )}
            </View>

            <ScrollView
                ref={categoryScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                className="pl-6"
            >
                <View className="gap-2 pr-6">
                    <View className="flex-row gap-2">
                        {categoriesRow1.map((category) => (
                            <Chip
                                key={category}
                                label={category}
                                selected={selectedCategory === category}
                                onPress={() => onCategoryPress(category)}
                                size="category"
                            />
                        ))}
                    </View>
                    <View className="flex-row gap-2">
                        {categoriesRow2.map((category) => (
                            <Chip
                                key={category}
                                label={category}
                                selected={selectedCategory === category}
                                onPress={() => onCategoryPress(category)}
                                size="category"
                            />
                        ))}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
