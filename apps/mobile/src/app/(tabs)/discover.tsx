import { FeedListItem } from '@/components/FeedListItem';
import { LanguagePicker, type Language } from '@/components/LanguagePicker';
import { SearchBar } from '@/components/SearchBar';
import { Chip } from '@/components/ui/Chip';
import BottomSheet from '@gorhom/bottom-sheet';
import { Monicon } from '@monicon/native';
import { useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

// Feed categories from RSS dataset
const CATEGORIES = [
  'Technology & Programming',
  'Culture & Arts',
  'Lifestyle & Personal',
  'Miscellaneous',
  'Design & Creativity',
  'Science & Research',
  'News & Politics',
  'Gaming & Entertainment',
  'Business & Finance',
  'Artificial Intelligence',
  'Security & Privacy',
  'Education & Learning',
];

// Mock data
const MOCK_FEEDS = [
  {
    id: '1',
    title: 'Hacker News - Tech Discussions',
    description:
      'A source for discussions on programming, startups, technology, and related topics...',
    iconUrl: 'https://via.placeholder.com/48/FF6600/FFFFFF?text=Y',
  },
  {
    id: '2',
    title: 'TechCrunch: Startup Technology',
    description: 'Delivers comprehensive coverage of startup companies, technology advancements...',
    iconUrl: 'https://via.placeholder.com/48/0A9D58/FFFFFF?text=TC',
  },
  {
    id: '3',
    title: 'The Verge',
    description: 'Covering the intersection of technology, science, art, and culture...',
    iconUrl: 'https://via.placeholder.com/48/FA4616/FFFFFF?text=V',
  },
  {
    id: '4',
    title: 'Ars Technica',
    description: 'News and reviews on technology, science, and policy...',
    iconUrl: 'https://via.placeholder.com/48/FF4E00/FFFFFF?text=A',
  },
];

type ViewState = 'default' | 'category' | 'search' | 'focused';

// Mock recent searches
const RECENT_SEARCHES = ['artificial intelligence', 'design', 'technology news'];

export default function DiscoverScreen() {
  const [viewState, setViewState] = useState<ViewState>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('english');
  const [followingFeeds, setFollowingFeeds] = useState<Set<string>>(new Set(['2']));
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const languagePickerRef = useRef<BottomSheet>(null);
  const searchBarRef = useRef<any>(null);

  // Animation for search bar
  const searchBarTop = useSharedValue(0);

  const searchBarAnimatedStyle = useAnimatedStyle(() => ({
    paddingTop: withTiming(searchBarTop.value, { duration: 300 }),
  }));

  const handleCategoryPress = (category: string) => {
    setSelectedCategory(category);
    setViewState('category');
    setSearchQuery('');
    setIsSearchFocused(false);
    searchBarTop.value = 0;
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      setViewState('search');
      setSelectedCategory(null);
      setIsSearchFocused(false);
      searchBarRef.current?.blur();
      Keyboard.dismiss();
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
    setViewState('focused');
    setSelectedCategory(null);
  };

  const handleSearchCancel = () => {
    setIsSearchFocused(false);
    setSearchQuery('');
    setViewState('default');
    setSelectedCategory(null);
    searchBarRef.current?.blur();
    Keyboard.dismiss();
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleLanguagePress = () => {
    languagePickerRef.current?.expand();
  };

  const handleRecentSearchPress = (query: string) => {
    setSearchQuery(query);
    setViewState('search');
    setIsSearchFocused(false);
    searchBarRef.current?.blur();
    Keyboard.dismiss();
  };

  const handleFollowPress = (feedId: string) => {
    setFollowingFeeds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(feedId)) {
        newSet.delete(feedId);
      } else {
        newSet.add(feedId);
      }
      return newSet;
    });
  };

  const showClearButton = isSearchFocused || viewState === 'search' || viewState === 'category';
  const showCancelButton = isSearchFocused;

  // Split categories into two rows (6 per row)
  const categoriesRow1 = CATEGORIES.slice(0, 6);
  const categoriesRow2 = CATEGORIES.slice(6);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-1">
        {/* Header and Search Bar */}
        <Animated.View style={searchBarAnimatedStyle} className="px-6">
          {viewState === 'default' && (
            <Text className="mb-6 font-geist-bold text-3xl tracking-heading text-black">
              Discover feeds
            </Text>
          )}

          <SearchBar
            ref={searchBarRef}
            placeholder="What are you looking for?"
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={handleSearchFocus}
            onLanguagePress={handleLanguagePress}
            onClear={handleClearSearch}
            onCancel={handleSearchCancel}
            onSubmit={handleSearchSubmit}
            showClearButton={showClearButton}
            showCancelButton={showCancelButton}
            autoFocus={false}
          />

        </Animated.View>

        {/* Content Area */}
        <View className="mt-6 flex-1">
          {viewState === 'focused' ? (
            /* Recent Searches / Search Focus View */
            <ScrollView showsVerticalScrollIndicator={false} className="px-6">
              <Text className="mb-4 font-geist-semibold text-base text-black">
                Recent searches
              </Text>
              <View className="gap-3">
                {RECENT_SEARCHES.map((query, index) => (
                  <Pressable
                    key={index}
                    onPress={() => handleRecentSearchPress(query)}
                    className="flex-row items-center gap-3 py-2 transition-opacity active:opacity-60">
                    <Monicon name="solar:clock-circle-outline" size={20} color="#90988B" />
                    <Text className="flex-1 font-geist text-base text-black">{query}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          ) : viewState === 'default' ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Categories */}
              <View>
                <View className="mb-4 flex-row items-center justify-between px-6">
                  <Text className="font-geist-semibold text-base text-black">Categories</Text>
                  {selectedCategory && (
                    <Pressable
                      onPress={() => {
                        setViewState('default');
                        setSelectedCategory(null);
                      }}
                      className="transition-opacity active:opacity-60">
                      <Text className="font-geist-medium text-sm text-secondary">Clear</Text>
                    </Pressable>
                  )}
                </View>

                {/* Combined scrollable categories - both rows scroll together */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-6">
                  <View className="gap-2 pr-6">
                    {/* First row */}
                    <View className="flex-row gap-2">
                      {categoriesRow1.map((category) => (
                        <Chip
                          key={category}
                          label={category}
                          selected={selectedCategory === category}
                          onPress={() => handleCategoryPress(category)}
                        />
                      ))}
                    </View>
                    {/* Second row */}
                    <View className="flex-row gap-2">
                      {categoriesRow2.map((category) => (
                        <Chip
                          key={category}
                          label={category}
                          selected={selectedCategory === category}
                          onPress={() => handleCategoryPress(category)}
                        />
                      ))}
                    </View>
                  </View>
                </ScrollView>
              </View>

              {/* Trending */}
              <View className="mt-8 px-6">
                <Text className="mb-4 font-geist-semibold text-base text-black">Trending</Text>
                {MOCK_FEEDS.map((feed) => (
                  <FeedListItem
                    key={feed.id}
                    title={feed.title}
                    description={feed.description}
                    iconUrl={feed.iconUrl}
                    isFollowing={followingFeeds.has(feed.id)}
                    onFollowPress={() => handleFollowPress(feed.id)}
                  />
                ))}
              </View>
            </ScrollView>
          ) : (
            /* Feed List (for category or search view) */
            <View className="flex-1">
              {/* Show categories when filtering */}
              {selectedCategory && (
                <View className="mb-6">
                  <View className="mb-4 flex-row items-center justify-between px-6">
                    <Text className="font-geist-semibold text-base text-black">Categories</Text>
                    <Pressable
                      onPress={() => {
                        setViewState('default');
                        setSelectedCategory(null);
                      }}
                      className="transition-opacity active:opacity-60">
                      <Text className="font-geist-medium text-sm text-secondary">Clear</Text>
                    </Pressable>
                  </View>

                  {/* Combined scrollable categories - both rows scroll together */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-6">
                    <View className="gap-2 pr-6">
                      {/* First row */}
                      <View className="flex-row gap-2">
                        {categoriesRow1.map((category) => (
                          <Chip
                            key={category}
                            label={category}
                            selected={selectedCategory === category}
                            onPress={() => handleCategoryPress(category)}
                          />
                        ))}
                      </View>
                      {/* Second row */}
                      <View className="flex-row gap-2">
                        {categoriesRow2.map((category) => (
                          <Chip
                            key={category}
                            label={category}
                            selected={selectedCategory === category}
                            onPress={() => handleCategoryPress(category)}
                          />
                        ))}
                      </View>
                    </View>
                  </ScrollView>
                </View>
              )}

              <FlatList
                data={MOCK_FEEDS}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <FeedListItem
                    title={item.title}
                    description={item.description}
                    iconUrl={item.iconUrl}
                    isFollowing={followingFeeds.has(item.id)}
                    onFollowPress={() => handleFollowPress(item.id)}
                    className="px-6"
                  />
                )}
                contentContainerClassName="px-0"
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}
        </View>
      </View>

      {/* Language Picker Bottom Sheet */}
      <LanguagePicker
        ref={languagePickerRef}
        initialLanguage={selectedLanguage}
        onLanguageChange={setSelectedLanguage}
      />
    </SafeAreaView>
  );
}
