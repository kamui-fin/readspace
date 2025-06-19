import React, { useRef, useState, useCallback } from "react";
import { View } from "@showtime-xyz/universal.view";
import { useSafeAreaInsets } from "@showtime-xyz/universal.safe-area";
import { PageIndicator } from "react-native-page-indicator"; // adjust import if needed
import {
	Animated,
	NativeScrollEvent,
	NativeSyntheticEvent,
	ScrollView,
	useWindowDimensions,
} from "react-native";
import { COLORS } from "@/src/lib/constants";
import { Button } from "@components/ui/Button";

interface StepperProps {
	pages: React.ReactNode[];
	onNext?: () => void;
}

export function Stepper({ pages, onNext }: StepperProps) {
	const colors = COLORS.light;
	const { width, height } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const indicatorSize = 4;
	const scrollX = useRef(new Animated.Value(0)).current;
	const scrollRef = useRef<ScrollView>(null);
	const animatedCurrent = useRef(Animated.divide(scrollX, width)).current;
	const [current, setCurrent] = useState(0);

	const handleScrollEnd = useCallback(
		(event: NativeSyntheticEvent<NativeScrollEvent>) => {
			const index = Math.round(event.nativeEvent.contentOffset.x / width);
			if (index !== current) {
				setCurrent(index);
			}
		},
		[width, current],
	);

	return (
		<View
			style={{
				flex: 1,
				paddingTop: insets.top,
				backgroundColor: colors.background,
			}}
		>
			<PageIndicator
				gap={0}
				variant="train"
				borderRadius={0}
				color={colors.grey3}
				activeColor={COLORS.black}
				size={indicatorSize}
				dashSize={indicatorSize * 22}
				count={pages.length}
				current={animatedCurrent}
			/>
			{/* Pages */}
			<Animated.ScrollView
				ref={scrollRef}
				horizontal
				pagingEnabled
				showsHorizontalScrollIndicator={false}
				onMomentumScrollEnd={handleScrollEnd}
				onScroll={Animated.event(
					[{ nativeEvent: { contentOffset: { x: scrollX } } }],
					{ useNativeDriver: true },
				)}
				style={{ flex: 1 }}
			>
				{pages.map((page, index) => (
					<View
						key={index}
						style={{
							width,
							height: height - 1.6 * insets.bottom,
							position: "relative",
						}}
					>
						{page}
					</View>
				))}
			</Animated.ScrollView>

			{/* Fixed Button at Bottom */}
			<View
				style={{
					position: "absolute",
					bottom: 0,
					left: 0,
					right: 0,
					paddingHorizontal: 28,
					paddingBottom: 2.8 * insets.bottom,
					backgroundColor: colors.background,
				}}
			>
				<Button size="large" onPress={onNext}>
					Continue
				</Button>
			</View>
		</View>
	);
}
