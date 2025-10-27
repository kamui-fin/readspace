import { FeedListItem } from '@/components/FeedListItem';
import { OnboardingLayout } from '@/components/OnboardingLayout';
import { Button } from '@/components/ui/Button';
import { LibraryIcon } from '@/components/ui/icons/LibraryIcon';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

// Mock feed data based on selected categories
const RECOMMENDED_FEEDS = [
  {
    id: '1',
    title: 'Hacker News - Tech Discussions',
    description:
      'A source for discussions on programming, startups, technology, and related topics...',
    iconUrl: 'https://news.ycombinator.com/favicon.ico',
  },
  {
    id: '2',
    title: 'TechCrunch: Startup Technology',
    description: 'Delivers comprehensive coverage of startup companies, technology advancements...',
    iconUrl:
      'https://techcrunch.com/wp-content/uploads/2015/02/cropped-cropped-favicon-gradient.png',
  },
  {
    id: '3',
    title: 'Smashing Magazine',
    description: 'For professional web designers and developers, with a focus on coding...',
    iconUrl: 'https://www.smashingmagazine.com/images/favicon/favicon.svg',
  },
  {
    id: '4',
    title: 'CSS-Tricks',
    description: 'Daily articles about CSS, HTML, JavaScript, and web design and development...',
    iconUrl: 'https://css-tricks.com/favicon.svg',
  },
  {
    id: '5',
    title: 'A List Apart',
    description: 'Explores the design, development, and meaning of web content...',
    iconUrl:
      'https://alistapart.com/wp-content/uploads/2019/03/cropped-icon_navigation-laurel-512.jpg',
  },
];

export default function OnboardingStep5() {
  const router = useRouter();
  const [followingFeeds, setFollowingFeeds] = useState<string[]>([]);

  const handleToggleFollow = (feedId: string) => {
    setFollowingFeeds((prev) =>
      prev.includes(feedId) ? prev.filter((id) => id !== feedId) : [...prev, feedId]
    );
  };

  const handleFinish = () => {
    // Mock functionality - navigate to main app
    router.replace('/(tabs)');
  };

  const minFollowCount = 3;
  const canFinish = followingFeeds.length >= minFollowCount;

  return (
    <OnboardingLayout
      currentStep={4}
      totalSteps={5}
      icon={<LibraryIcon size={24} color="#90988B" />}
      title="Picked for you."
      subtitle="Here are some top feeds based on your interests.">
      <View className="flex-1">
        <View>
          {RECOMMENDED_FEEDS.map((feed) => (
            <FeedListItem
              key={feed.id}
              title={feed.title}
              description={feed.description}
              iconUrl={feed.iconUrl}
              isFollowing={followingFeeds.includes(feed.id)}
              onFollowPress={() => handleToggleFollow(feed.id)}
              className="border-b border-mid-grey"
            />
          ))}
        </View>

        <View className="flex-1" />

        <Button variant="primary" size="lg" fullWidth onPress={handleFinish} disabled={!canFinish}>
          {canFinish
            ? 'Start reading!'
            : `Follow at least ${minFollowCount} feeds (${followingFeeds.length}/${minFollowCount})`}
        </Button>
      </View>
    </OnboardingLayout>
  );
}
