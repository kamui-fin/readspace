import {
	CreateFolderModal,
	type CreateFolderModalRef,
} from "@components/bottom-sheets/create-folder";
import { PlusIcon } from "@components/icons/plus";
import { CategoriesList } from "@/components/screens/discover/ui/categories.list";
import { RecentSearches } from "@components/screens/discover/ui/recent-searches";
import { SearchResults } from "@/components/screens/discover/ui/search-results.list";
import {
	type Language,
	SearchBar,
} from "@components/screens/discover/ui/search-bar.input";
import { TrendingSection } from "@/components/screens/discover/ui/trending-section.list";
import { Button } from "@components/ui/button";
import { Text } from "@components/ui/text";
import { useIsDarkMode } from "@hooks/useIsDarkMode";
import { useDiscoverScroll } from "@contexts/discover-scroll-context";
import { BOTTOM_TABBAR_BASE_HEIGHT } from "@lib/constants/app";
import { COLORS } from "@lib/constants/colors";
import {
	ApiClient,
	type DiscoverSearchResponse,
	useTrendingFeeds,
} from "@readspace/shared";
import { useSearchHistory } from "@stores/search-history";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import type { TextInput as RNTextInput } from "react-native";
import {
	Keyboard,
	LayoutAnimation,
	Pressable,
	ScrollView,
	TouchableWithoutFeedback,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CATEGORIES = [
	"Technology & Programming",
	"Culture & Arts",
	"Lifestyle & Personal",
	"Miscellaneous",
	"Design & Creativity",
	"Science & Research",
	"News & Politics",
	"Gaming & Entertainment",
	"Business & Finance",
	"Artificial Intelligence",
	"Security & Privacy",
	"Education & Learning",
];

type ViewState = "default" | "category" | "search" | "focused";

export function DiscoverScreen() {
	const [viewState, setViewState] = useState<ViewState>("default");
	const [searchQuery, setSearchQuery] = useState("");
	const [activeQuery, setActiveQuery] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [selectedLanguage, setSelectedLanguage] = useState<Language>("english");
	const [isSearchFocused, setIsSearchFocused] = useState(false);

	const searchBarRef = useRef<RNTextInput>(null);
	const categoryScrollRef = useRef<ScrollView>(null);
	const createFolderModalRef = useRef<CreateFolderModalRef>(null);
	const isDark = useIsDarkMode();
	const colors = COLORS[isDark ? "dark" : "light"];
	const { searches: recentSearches, addSearch } = useSearchHistory();
	const { setIsSearching } = useDiscoverScroll();

	// Compute bottom padding to account for tab bar
	// Tab bar height = BOTTOM_TABBAR_BASE_HEIGHT + 0.8 * safeAreaBottom (from BottomTabbar component)
	// Add extra spacing (24px) for better visual separation
	const contentPaddingBottom = BOTTOM_TABBAR_BASE_HEIGHT + 24;

	const languageCode =
		selectedLanguage === "english"
			? "en"
			: selectedLanguage === "chinese"
				? "zh"
				: "ja";

	// Fetch trending feeds
	const {
		data: trendingData,
		isLoading: isTrendingLoading,
		isFetching: isTrendingFetching,
		error: trendingError,
	} = useTrendingFeeds(
		{ language: languageCode, limit: 20 },
		{ enabled: viewState === "default" },
	);

	const showTrendingSkeleton =
		(isTrendingLoading || isTrendingFetching) &&
		(!trendingData || trendingData.length === 0);

	// Search/category feeds
	const {
		data: searchData,
		isLoading: isSearchLoading,
		isFetching,
		isSuccess: isSearchSuccess,
	} = useQuery<DiscoverSearchResponse>({
		queryKey: [
			"discover",
			"search",
			activeQuery,
			selectedCategory,
			languageCode,
		],
		queryFn: async () => {
			return await ApiClient.rss.searchFeeds({
				q: activeQuery || undefined,
				category: selectedCategory || undefined,
				language: languageCode,
				limit: 50,
			});
		},
		enabled: viewState === "category" || viewState === "search",
	});

	const showSearchSkeleton =
		(isSearchLoading || isFetching) && !isSearchSuccess && !searchData;

	const handleCategoryPress = useCallback(
		(category: string) => {
			setSelectedCategory(category);
			setViewState("category");
			setSearchQuery("");
			setActiveQuery("");
			setIsSearchFocused(false);
			setTimeout(() => {
				categoryScrollRef.current?.scrollTo({ x: 0, animated: true });
			}, 0);
			setIsSearching?.(true);
		},
		[setIsSearching],
	);

	const orderedCategories = selectedCategory
		? [selectedCategory, ...CATEGORIES.filter((c) => c !== selectedCategory)]
		: CATEGORIES;

	const categoriesRow1 = orderedCategories.slice(0, 6);
	const categoriesRow2 = orderedCategories.slice(6);

	const handleSearchSubmit = useCallback(() => {
		if (!searchQuery.trim()) return;
		addSearch(searchQuery);
		setActiveQuery(searchQuery);
		setViewState("search");
		setSelectedCategory(null);
		setIsSearchFocused(false);
		searchBarRef.current?.blur();
		Keyboard.dismiss();
		setIsSearching?.(true);
	}, [searchQuery, addSearch, setIsSearching]);

	const handleSearchChange = useCallback((text: string) => {
		setSearchQuery(text);
	}, []);

	const handleSearchFocus = useCallback(() => {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setIsSearchFocused(true);
		setViewState("focused");
		setSelectedCategory(null);
		setIsSearching?.(true);
	}, [setIsSearching]);

	const handleSearchCancel = useCallback(() => {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setIsSearchFocused(false);
		setSearchQuery("");
		setActiveQuery("");
		setViewState("default");
		setSelectedCategory(null);
		searchBarRef.current?.blur();
		Keyboard.dismiss();
		setIsSearching?.(false);
	}, [setIsSearching]);

	const handleClearSearch = useCallback(() => {
		setSearchQuery("");
		setActiveQuery("");
	}, []);

	const handleLanguageChange = useCallback((language: Language) => {
		setSelectedLanguage(language);
	}, []);

	const handleRecentSearchPress = useCallback(
		(query: string) => {
			addSearch(query);
			setSearchQuery(query);
			setActiveQuery(query);
			setViewState("search");
			setIsSearchFocused(false);
			searchBarRef.current?.blur();
			Keyboard.dismiss();
			setIsSearching?.(true);
		},
		[addSearch, setIsSearching],
	);

	const showClearButton =
		isSearchFocused || viewState === "search" || viewState === "category";
	const showCancelButton = isSearchFocused;

	const handleOutsidePress = useCallback(() => {
		// Only cancel search when in focused mode
		if (viewState === "focused") {
			handleSearchCancel();
		}
	}, [viewState, handleSearchCancel]);

	const handleClearCategory = useCallback(() => {
		setViewState("default");
		setSelectedCategory(null);
		setIsSearching?.(false);
	}, [setIsSearching]);

	const insets = useSafeAreaInsets();

	return (
		<View
			className="flex-1 bg-white"
			style={{ paddingTop: insets.top }}
		>
			<TouchableWithoutFeedback onPress={handleOutsidePress}>
				<View className="flex-1">
					{/* Header and Search Bar - Always visible */}
					<View className="px-6">
						{viewState === "default" && (
							<View className="mb-8 flex-row items-center justify-between">
								<Text
									size="lg"
									fontFamily="geist-bold"
									className="tracking-heading text-black"
								>
									Discover feeds
								</Text>
								<Button
									variant="icon"
									size="large"
									className="h-9 w-9"
									fullWidth={false}
									onPress={() => createFolderModalRef.current?.present()}
								>
									<PlusIcon
										size={22}
										color={colors.primary_foreground}
										strokeWidth={2}
									/>
								</Button>
							</View>
						)}

						<View className="pb-4">
							<Pressable onPress={(e) => e.stopPropagation()}>
								<SearchBar
									ref={searchBarRef}
									value={searchQuery}
									onChangeText={handleSearchChange}
									onFocus={handleSearchFocus}
									onLanguageChange={handleLanguageChange}
									selectedLanguage={selectedLanguage}
									onClear={handleClearSearch}
									onCancel={handleSearchCancel}
									onSubmit={handleSearchSubmit}
									showClearButton={showClearButton}
									showCancelButton={showCancelButton}
									autoFocus={false}
								/>
							</Pressable>
						</View>
					</View>

					{/* Content Area */}
					<View className="flex-1">
						{viewState === "focused" ? (
							/* Recent Searches */
							<RecentSearches
								recentSearches={recentSearches}
								onRecentSearchPress={handleRecentSearchPress}
								contentPaddingBottom={contentPaddingBottom}
								colors={colors}
							/>
						) : viewState === "default" ? (
							/* Default Trending View */
							<ScrollView
								showsVerticalScrollIndicator={false}
								className="flex-1"
								contentContainerStyle={{
									paddingBottom: contentPaddingBottom,
								}}
							>
								<CategoriesList
									selectedCategory={selectedCategory}
									categoriesRow1={categoriesRow1}
									categoriesRow2={categoriesRow2}
									onCategoryPress={handleCategoryPress}
									onClearCategory={handleClearCategory}
									categoryScrollRef={categoryScrollRef}
								/>

								<TrendingSection
									showTrendingSkeleton={showTrendingSkeleton}
									trendingError={trendingError}
									trendingData={trendingData}
								/>
							</ScrollView>
						) : (
							/* Search/Category Results */
							<SearchResults
								showSearchSkeleton={showSearchSkeleton}
								searchData={searchData}
								contentPaddingBottom={contentPaddingBottom}
								selectedCategory={selectedCategory}
								categoriesRow1={categoriesRow1}
								categoriesRow2={categoriesRow2}
								onCategoryPress={handleCategoryPress}
								onClearCategory={handleClearCategory}
								categoryScrollRef={categoryScrollRef}
							/>
						)}
					</View>
				</View>
			</TouchableWithoutFeedback>

			{/* Create Folder Modal */}
			<CreateFolderModal ref={createFolderModalRef} />
		</View>
	);
}
