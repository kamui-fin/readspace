import { OnboardingLayout } from '@/components/OnboardingLayout';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { TagIcon } from '@/components/ui/icons/TagIcon';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

const FEED_CATEGORIES = [
    { id: 'business-finance', label: 'Business & Finance' },
    { id: 'lifestyle', label: 'Lifestyle' },
    { id: 'artificial-intelligence', label: 'Artificial Intelligence' },
    { id: 'programming', label: 'Programming' },
    { id: 'design', label: 'Design' },
    { id: 'security', label: 'Security' },
    { id: 'education', label: 'Education' },
    { id: 'miscellaneous', label: 'Miscellaneous' },
    { id: 'science', label: 'Science' },
    { id: 'gaming', label: 'Gaming' },
    { id: 'culture', label: 'Culture' },
];

export default function OnboardingStep4() {
    const router = useRouter();
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    const handleToggleCategory = (categoryId: string) => {
        setSelectedCategories((prev) =>
            prev.includes(categoryId)
                ? prev.filter((id) => id !== categoryId)
                : [...prev, categoryId]
        );
    };

    const handleNext = () => {
        // Mock functionality - just navigate to next step
        router.push('/onboarding/step-5');
    };

    return (
        <OnboardingLayout
            currentStep={3}
            totalSteps={5}
            icon={<TagIcon size={24} color="#90988B" />}
            title="What topics sound good right now?"
            subtitle="">
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
