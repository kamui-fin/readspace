import { ArticleListItem } from '@/components/ArticleListItem';
import { FeedListItem } from '@/components/FeedListItem';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { CircleIcon } from '@/components/ui/CircleIcon';
import { Input } from '@/components/ui/Input';
import { PageHeading } from '@/components/ui/PageHeading';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Radio } from '@/components/ui/Radio';
import { Stepper } from '@/components/ui/Stepper';
import { Switch } from '@/components/ui/Switch';
import { Monicon } from '@monicon/native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

export default function DesignSystem() {
    const router = useRouter();
    const [progressStep, setProgressStep] = useState(2);
    const [selectedChips, setSelectedChips] = useState<string[]>(['programming']);
    const [selectedRadio, setSelectedRadio] = useState<string>('english');
    const [switchValue, setSwitchValue] = useState(true);
    const [inputValue, setInputValue] = useState('');
    const [inputWithLabelValue, setInputWithLabelValue] = useState('example@gmail.com');

    const toggleChip = (chip: string) => {
        setSelectedChips((prev) =>
            prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <ScrollView className="flex-1 px-6 py-8" showsVerticalScrollIndicator={false}>
                {/* Header */}
                <PageHeading className="mb-8">Readspace Design System</PageHeading>

                {/* Test Welcome Screen Button */}
                <View className="mb-10">
                    <Button variant="secondary" onPress={() => router.push('/welcome')}>
                        View Welcome Screen
                    </Button>
                </View>

                {/* Typography Section */}
                <View className="mb-10">
                    <Text className="mb-6 font-geist-bold text-2xl tracking-heading text-black">
                        Typography
                    </Text>

                    {/* Geist Sans */}
                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">GEIST SANS</Text>
                        <Text className="mb-2 font-geist text-base text-black">
                            Geist Regular - The quick brown fox jumps over the lazy dog
                        </Text>
                        <Text className="mb-2 font-geist-medium text-base text-black">
                            Geist Medium - The quick brown fox jumps over the lazy dog
                        </Text>
                        <Text className="mb-2 font-geist-semibold text-base text-black">
                            Geist Semibold - The quick brown fox jumps over the lazy dog
                        </Text>
                        <Text className="font-geist-bold text-base text-black">
                            Geist Bold - The quick brown fox jumps over the lazy dog
                        </Text>
                    </View>

                    {/* Figtree */}
                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">FIGTREE (LOGO)</Text>
                        <Text className="font-figtree text-2xl tracking-heading text-black">Readspace</Text>
                    </View>

                    {/* EB Garamond */}
                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">
                            EB GARAMOND (READING)
                        </Text>
                        <Text className="mb-2 font-garamond text-lg leading-7 text-black">
                            EB Garamond Regular - In the beginning was the Word, and the Word was with God, and
                            the Word was God.
                        </Text>
                        <Text className="mb-2 font-garamond-medium text-lg leading-7 text-black">
                            EB Garamond Medium - He was in the beginning with God.
                        </Text>
                        <Text className="mb-2 font-garamond-semibold text-lg leading-7 text-black">
                            EB Garamond Semibold - All things were made through him.
                        </Text>
                        <Text className="font-garamond-bold text-lg leading-7 text-black">
                            EB Garamond Bold - And without him was not any thing made.
                        </Text>
                    </View>
                </View>

                {/* Colors Section */}
                <View className="mb-10">
                    <Text className="mb-6 font-geist-bold text-2xl tracking-heading text-black">
                        Color Palette
                    </Text>

                    <View className="flex-row flex-wrap gap-4">
                        {/* Primary */}
                        <View className="items-center">
                            <View className="mb-2 h-20 w-20 rounded-xl border border-grey/20 bg-primary" />
                            <Text className="font-geist text-xs text-black">Primary</Text>
                            <Text className="font-geist text-xs text-grey">#386641</Text>
                        </View>

                        {/* Secondary */}
                        <View className="items-center">
                            <View className="mb-2 h-20 w-20 rounded-xl border border-grey/20 bg-secondary" />
                            <Text className="font-geist text-xs text-black">Secondary</Text>
                            <Text className="font-geist text-xs text-grey">#6A994E</Text>
                        </View>

                        {/* Mid Grey */}
                        <View className="items-center">
                            <View className="mb-2 h-20 w-20 rounded-xl border border-grey/20 bg-mid-grey" />
                            <Text className="font-geist text-xs text-black">Mid Grey</Text>
                            <Text className="font-geist text-xs text-grey">#F3F3F3</Text>
                        </View>

                        {/* Grey */}
                        <View className="items-center">
                            <View className="mb-2 h-20 w-20 rounded-xl border border-grey/20 bg-grey" />
                            <Text className="font-geist text-xs text-black">Grey</Text>
                            <Text className="font-geist text-xs text-grey">#90988B</Text>
                        </View>

                        {/* Red */}
                        <View className="items-center">
                            <View className="mb-2 h-20 w-20 rounded-xl border border-grey/20 bg-red" />
                            <Text className="font-geist text-xs text-black">Red</Text>
                            <Text className="font-geist text-xs text-grey">#EA4335</Text>
                        </View>

                        {/* Green Grey */}
                        <View className="items-center">
                            <View className="mb-2 h-20 w-20 rounded-xl border border-grey/20 bg-green-grey" />
                            <Text className="font-geist text-xs text-black">Green Grey</Text>
                            <Text className="font-geist text-xs text-grey">#D1DBCD</Text>
                        </View>

                        {/* Light Grey */}
                        <View className="items-center">
                            <View className="mb-2 h-20 w-20 rounded-xl border border-grey/20 bg-light-grey" />
                            <Text className="font-geist text-xs text-black">Light Grey</Text>
                            <Text className="font-geist text-xs text-grey">#F9F9F9</Text>
                        </View>

                        {/* Black */}
                        <View className="items-center">
                            <View className="mb-2 h-20 w-20 rounded-xl border border-grey/20 bg-black" />
                            <Text className="font-geist text-xs text-black">Black</Text>
                            <Text className="font-geist text-xs text-grey">#232222</Text>
                        </View>
                    </View>
                </View>

                {/* Buttons Section */}
                <View className="mb-10">
                    <Text className="mb-6 font-geist-bold text-2xl tracking-heading text-black">Buttons</Text>

                    {/* Primary Variant */}
                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">PRIMARY</Text>
                        <Button variant="primary" onPress={() => toast('Primary button pressed')}>
                            Primary Button
                        </Button>
                    </View>

                    {/* Secondary Variant */}
                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">SECONDARY</Text>
                        <Button variant="secondary" onPress={() => toast('Secondary button pressed')}>
                            Secondary Button
                        </Button>
                    </View>

                    {/* Black Variant */}
                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">BLACK</Text>
                        <Button variant="black" onPress={() => toast('Black button pressed')}>
                            Black Button
                        </Button>
                    </View>

                    {/* Neutral Variant */}
                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">NEUTRAL</Text>
                        <Button variant="neutral" onPress={() => toast('Neutral button pressed')}>
                            Neutral Button
                        </Button>
                    </View>

                    {/* Outline Variant */}
                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">OUTLINE</Text>
                        <Button variant="outline" onPress={() => toast('Outline button pressed')}>
                            Outline Button
                        </Button>
                    </View>

                    {/* Size Variants */}
                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">SIZES</Text>
                        <View className="gap-3">
                            <Button variant="primary" size="sm" onPress={() => { }}>
                                Small Button
                            </Button>
                            <Button variant="primary" size="default" onPress={() => { }}>
                                Default Button
                            </Button>
                            <Button variant="primary" size="lg" onPress={() => { }}>
                                Large Button
                            </Button>
                        </View>
                    </View>

                    {/* States */}
                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">STATES</Text>
                        <View className="gap-3">
                            <Button variant="primary" disabled onPress={() => { }}>
                                Disabled Button
                            </Button>
                            <Button variant="primary" loading onPress={() => { }}>
                                Loading Button
                            </Button>
                        </View>
                    </View>

                    {/* Full Width */}
                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">FULL WIDTH</Text>
                        <Button variant="primary" fullWidth onPress={() => { }}>
                            Full Width Button
                        </Button>
                    </View>
                </View>

                {/* Input Section */}
                <View className="mb-10">
                    <Text className="mb-6 font-geist-bold text-2xl tracking-heading text-black">
                        Text Inputs
                    </Text>

                    {/* Basic Input */}
                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">BASIC INPUT</Text>
                        <Input placeholder="Enter text..." value={inputValue} onChangeText={setInputValue} />
                    </View>

                    {/* Input with Label */}
                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">WITH LABEL</Text>
                        <Input
                            label="Email"
                            placeholder="example@gmail.com"
                            value={inputWithLabelValue}
                            onChangeText={setInputWithLabelValue}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    {/* Input with Error */}
                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">WITH ERROR</Text>
                        <Input
                            label="API URL"
                            placeholder="http://localhost:18008"
                            value="http://localhost:18008"
                            error="Invalid URL format"
                        />
                    </View>
                </View>

                {/* Badge Section */}
                <View className="mb-10">
                    <Text className="mb-6 font-geist-bold text-2xl tracking-heading text-black">
                        Badges (Data Pills)
                    </Text>

                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">
                            NON-INTERACTIVE LABELS
                        </Text>
                        <View className="flex-row flex-wrap gap-3">
                            <Badge label="Technology" />
                            <Badge label="Programming" />
                            <Badge label="Design" />
                            <Badge label="Science" />
                        </View>
                    </View>
                </View>

                {/* Chip Section */}
                <View className="mb-10">
                    <Text className="mb-6 font-geist-bold text-2xl tracking-heading text-black">Chips</Text>

                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">MULTI-SELECT FILTERS</Text>
                        <View className="flex-row flex-wrap gap-3">
                            <Chip
                                label="Lifestyle"
                                selected={selectedChips.includes('lifestyle')}
                                onPress={() => toggleChip('lifestyle')}
                            />
                            <Chip
                                label="Programming"
                                selected={selectedChips.includes('programming')}
                                onPress={() => toggleChip('programming')}
                            />
                            <Chip
                                label="Design"
                                selected={selectedChips.includes('design')}
                                onPress={() => toggleChip('design')}
                            />
                            <Chip
                                label="Science"
                                selected={selectedChips.includes('science')}
                                onPress={() => toggleChip('science')}
                            />
                        </View>
                    </View>
                </View>

                {/* Radio Section */}
                <View className="mb-10">
                    <Text className="mb-6 font-geist-bold text-2xl tracking-heading text-black">
                        Radio Buttons
                    </Text>

                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">LANGUAGE SELECTION</Text>
                        <View className="gap-4">
                            <Radio
                                label="English"
                                selected={selectedRadio === 'english'}
                                onPress={() => setSelectedRadio('english')}
                            />
                            <Radio
                                label="Spanish"
                                selected={selectedRadio === 'spanish'}
                                onPress={() => setSelectedRadio('spanish')}
                            />
                        </View>
                    </View>
                </View>

                {/* Progress Bar Section */}
                <View className="mb-10">
                    <Text className="mb-6 font-geist-bold text-2xl tracking-heading text-black">
                        Progress Bar
                    </Text>

                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">PERCENTAGE PROGRESS</Text>
                        <View className="gap-4">
                            <ProgressBar percentage={progressStep * 20} />
                            <View className="flex-row gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onPress={() => setProgressStep(Math.max(0, progressStep - 1))}
                                    disabled={progressStep === 0}>
                                    Previous
                                </Button>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onPress={() => setProgressStep(Math.min(5, progressStep + 1))}
                                    disabled={progressStep === 5}>
                                    Next
                                </Button>
                            </View>
                        </View>
                    </View>

                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">STEPPER</Text>
                        <View className="gap-4">
                            <Stepper totalSteps={5} currentStep={progressStep} />
                            <View className="flex-row gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onPress={() => setProgressStep(Math.max(0, progressStep - 1))}
                                    disabled={progressStep === 0}>
                                    Previous
                                </Button>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onPress={() => setProgressStep(Math.min(5, progressStep + 1))}
                                    disabled={progressStep === 5}>
                                    Next
                                </Button>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Switch Section */}
                <View className="mb-10">
                    <Text className="mb-6 font-geist-bold text-2xl tracking-heading text-black">Switch</Text>

                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">TOGGLE SWITCH</Text>
                        <View className="flex-row items-center gap-4">
                            <Switch value={switchValue} onValueChange={setSwitchValue} />
                            <Text className="font-geist text-base text-grey">
                                {switchValue ? 'Enabled' : 'Disabled'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* CircleIcon Section */}
                <View className="mb-10">
                    <Text className="mb-6 font-geist-bold text-2xl tracking-heading text-black">
                        Circle Icons
                    </Text>

                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">STATIC</Text>
                        <View className="flex-row gap-4">
                            <CircleIcon variant="static">
                                <Monicon name="lucide:mail" size={24} color="#90988B" />
                            </CircleIcon>
                            <CircleIcon variant="static" size="sm">
                                <Monicon name="lucide:settings" size={20} color="#90988B" />
                            </CircleIcon>
                            <CircleIcon variant="static" size="lg">
                                <Monicon name="lucide:user" size={28} color="#90988B" />
                            </CircleIcon>
                        </View>
                    </View>

                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">CLICKABLE</Text>
                        <View className="flex-row gap-4">
                            <CircleIcon variant="clickable" onPress={() => toast('Icon pressed!')}>
                                <Monicon name="lucide:bookmark" size={24} color="#90988B" />
                            </CircleIcon>
                            <CircleIcon variant="clickable" onPress={() => toast('Search pressed!')}>
                                <Monicon name="lucide:search" size={24} color="#90988B" />
                            </CircleIcon>
                        </View>
                    </View>
                </View>

                {/* Feed List Item Section */}
                <View className="mb-10">
                    <Text className="mb-6 font-geist-bold text-2xl tracking-heading text-black">
                        Feed List Items
                    </Text>

                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">FEED ITEMS</Text>
                        <View className="gap-3">
                            <FeedListItem
                                title="Hacker News - Tech Discussions"
                                description="A source for discussions on programming, startups, technology, and related topics..."
                                isFollowing={false}
                                onPress={() => toast('Feed pressed')}
                                onFollowPress={() => toast('Follow pressed')}
                            />
                            <FeedListItem
                                title="WIRED"
                                description="WIRED is where tomorrow is realized. It is the essential source of information and ideas..."
                                isFollowing={true}
                                onPress={() => toast('Feed pressed')}
                                onFollowPress={() => toast('Unfollow pressed')}
                            />
                        </View>
                    </View>
                </View>

                {/* Article List Item Section */}
                <View className="mb-10">
                    <Text className="mb-6 font-geist-bold text-2xl tracking-heading text-black">
                        Article List Items
                    </Text>

                    <View className="mb-6">
                        <Text className="mb-3 font-geist-semibold text-sm text-grey">ARTICLE LIST ITEMS</Text>
                        <View className="gap-3">
                            <ArticleListItem
                                source="TECH CRUNCH"
                                timestamp="10 min ago"
                                title="Automattic CEO calls Tumblr his 'biggest failure' so far"
                                description="At WordCamp Canada 2025, Automattic CEO Matt Mullenweg called Tumblr his 'biggest failure,' noting the challenge of maintaining..."
                                faviconUrl="https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://thehackernews.com&size=256"
                                imageUrl="https://media.wired.com/photos/68f943ad21295bfbfeb4231f/master/w_2240,c_limit/House-Fishing-Culture.jpg"
                                isRead={false}
                                isSaved={false}
                                onPress={() => toast('Article pressed')}
                            />
                            <ArticleListItem
                                source="BBC NEWS"
                                timestamp="32 min ago"
                                title="Pizza Hut reveals locations where restaurants will close"
                                description="The locations of the Pizza Hut restaurants and delivery sites to close across the UK has been revealed."
                                faviconUrl="https://www.thenation.com/wp-content/uploads/2020/09/n-logo.png"
                                isRead={true}
                                isSaved={true}
                                onPress={() => toast('Article pressed')}
                            />
                            <ArticleListItem
                                source="WIRED"
                                timestamp="2h ago"
                                title="What Went Down With Kryptos, the CIA's Cryptic Sculpture"
                                description="The CIA's famous sculpture has puzzled codebreakers for decades."
                                imageUrl="https://media.wired.com/photos/68fa75f840d57adab1938301/16:9/w_1600,c_limit/Backchannel-What-Went-Down-With-Kryptos-Key-Business-564117411.jpg"
                                faviconUrl="https://www.vg247.com/static/9368edca4ffe1536fbac707dadf7175b/icon/apple-touch-icon.png"
                                isRead={false}
                                isSaved={false}
                                onPress={() => toast('Article pressed')}
                            />
                            <ArticleListItem
                                source="WIRED"
                                timestamp="5h ago"
                                title="House Republicans Are Fishing for a Climate Culture War"
                                description="GOP lawmakers are targeting NOAA climate scientists in what experts say is a politically motivated attack on science."
                                faviconUrl="https://www.vg247.com/static/9368edca4ffe1536fbac707dadf7175b/icon/apple-touch-icon.png"
                                isRead={false}
                                isSaved={true}
                                onPress={() => toast('Article pressed')}
                            />
                            <ArticleListItem
                                source="WIRED"
                                timestamp="1d ago"
                                title="How to join an Italian olive harvest"
                                description="Experience the traditional olive harvest in the rolling hills of Tuscany while learning ancient farming techniques passed down through generations."
                                faviconUrl="https://www.vg247.com/static/9368edca4ffe1536fbac707dadf7175b/icon/apple-touch-icon.png"
                                isRead={false}
                                isSaved={false}
                                onPress={() => toast('Article pressed')}
                            />
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

