import { COLORS } from '@/constants/Colors';
import { OnboardingLayout } from '@/components/OnboardingLayout';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { TagIcon } from '@/components/ui/icons/TagIcon';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { View } from 'react-native';

const FEED_CATEGORIES = [
    { id: 'Technology & Programming', label: 'Technology' },
    { id: 'Science & Research', label: 'Science' },
    { id: 'Artificial Intelligence', label: 'Artificial Intelligence' },
    { id: 'Design & Creativity', label: 'Creativity' },
    { id: 'Business & Finance', label: 'Business & Finance' },
    { id: 'News & Politics', label: 'News & Politics' },
    { id: 'Miscellaneous', label: 'Other' },
    { id: 'Lifestyle & Personal', label: 'Lifestyle' },
    { id: 'Gaming & Entertainment', label: 'Entertainment' },
    { id: 'Culture & Arts', label: 'Culture & Arts' },
    { id: 'Security & Privacy', label: 'Security' },
    { id: 'Education & Learning', label: 'Learning' },
];

export default function FeedCategoriesStep() {
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    const handleToggleCategory = (categoryId: string) => {
        setSelectedCategories((prev) =>
            prev.includes(categoryId)
                ? prev.filter((id) => id !== categoryId)
                : [...prev, categoryId]
        );
    };

    const handleNext = () => {
        // Navigate to recommendations with selected categories
        const categoriesParam = selectedCategories.join(',');
        router.push(
            `/onboarding/feeds/recommendations?categories=${encodeURIComponent(categoriesParam)}`
        );
    };

    const iconColor = colorScheme === 'dark' ? COLORS.dark.grey : COLORS.light.grey;

    return (
        <OnboardingLayout
            currentStep={0}
            totalSteps={2}
            icon={<TagIcon size={24} color={iconColor} />}
            title="What topics sound good right now?"
            subtitle="Choose topics to build your personalized feed">
            <View className="flex-1">
                <View className="flex-row flex-wrap gap-2">
                    {FEED_CATEGORIES.map((category) => (
                        <Chip
                            key={category.id}
                            label={category.label}
                            selected={selectedCategories.includes(category.id)}
                            onPress={() => handleToggleCategory(category.id)}
                        />
                    ))}
                </View>

                <View className="flex-1" />

                <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onPress={handleNext}
                    disabled={selectedCategories.length === 0}>
                    Next
                </Button>
            </View>
        </OnboardingLayout>
    );
}
