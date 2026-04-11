import { Button } from '@components/ui/button';
import { Chip } from '@components/ui/chip';
import { Text } from '@components/ui/text';
import { MOBILE_CATEGORY_NAMES } from '@readspace/shared';
import { useOnboardingStore } from '@stores/onboarding';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

const CATEGORIES = Object.keys(MOBILE_CATEGORY_NAMES);

export function CategorySelectionStep({ onNext }: { onNext: () => void }) {
    const { onboardingData, updateOnboardingData } = useOnboardingStore();
    const [selectedCategories, setSelectedCategories] = useState<string[]>(
        onboardingData.selectedCategories || []
    );

    const toggleCategory = (categoryId: string) => {
        setSelectedCategories((prev) => {
            if (prev.includes(categoryId)) {
                return prev.filter((id) => id !== categoryId);
            }
            return [...prev, categoryId];
        });
    };

    const handleNext = () => {
        updateOnboardingData({ selectedCategories });
        onNext();
    };

    return (
        <View className="flex-1 px-6">
            <View className="mb-8">
                <Text size="3xl" fontFamily="geist-bold" className="text-primary_foreground dark:text-primary_foreground mb-2">
                    What topics interest you?
                </Text>
                <Text size="lg" fontFamily="geist-regular" className="text-grey dark:text-grey">
                    Build your very own information diet.
                </Text>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <View className="flex-row flex-wrap gap-x-3 gap-y-3 pb-8">
                    {CATEGORIES.map((categoryId) => {
                        const isSelected = selectedCategories.includes(categoryId);
                        return (
                            <Chip
                                key={categoryId}
                                label={MOBILE_CATEGORY_NAMES[categoryId as keyof typeof MOBILE_CATEGORY_NAMES]}
                                selected={isSelected}
                                onPress={() => toggleCategory(categoryId)}
                                size="category"
                            />
                        );
                    })}
                </View>
            </ScrollView>

            <View className="py-2">
                {selectedCategories.length > 0 && (
                    <Text size="sm" fontFamily="geist-medium" className="text-center text-primary dark:text-primary mb-4">
                        {selectedCategories.length} topic{selectedCategories.length === 1 ? '' : 's'} selected
                    </Text>
                )}
                <Button
                    variant="primary"
                    size="large"
                    onPress={handleNext}
                    disabled={selectedCategories.length === 0}
                    style={{ borderRadius: 12 }}>
                    Continue
                </Button>
            </View>
        </View>
    );
}
