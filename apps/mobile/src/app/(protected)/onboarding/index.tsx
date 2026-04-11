import { Stepper, type StepperRef } from '@components/navigation/stepper';
import { CategorySelectionStep } from '@components/screens/onboarding/categories';
import { FeedSelectionStep } from '@components/screens/onboarding/feeds';
import { useRef, useState } from 'react';
import { View } from 'react-native';

export default function OnboardingScreen() {
    const stepperRef = useRef<StepperRef>(null);
    const [currentStep, setCurrentStep] = useState(0);

    const pages = [
        <CategorySelectionStep
            key="categories"
            onNext={() => stepperRef.current?.goToNext()}
        />,
        <FeedSelectionStep
            key="feeds"
            onNext={() => { }}
        />,
    ];

    return (
        <View className="flex-1 bg-screen">
            <Stepper
                ref={stepperRef}
                pages={pages}
                onStepChange={setCurrentStep}
                initialStep={0}
            />
        </View>
    );
}
