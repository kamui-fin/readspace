import { ArticleMenuModal } from '@/components/ArticleMenuModal';
import { ArticleReader } from '@/components/ArticleReader';
import { getMockArticle } from '@/utils/mockArticle';
import { generateMockSummary } from '@/utils/mockSummary';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Galeria } from '@nandorojo/galeria';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { Monicon } from '@monicon/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, Share, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

export default function ArticleScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const menuModalRef = useRef<BottomSheetModal>(null);

    // State
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [aiSummary, setAiSummary] = useState<string | undefined>(undefined);
    const [isLoadingSummary, setIsLoadingSummary] = useState(false);

    // Get article data
    const article = useMemo(() => getMockArticle(id || '1'), [id]);

    // Handlers
    const handleClose = useCallback(() => {
        router.back();
    }, [router]);

    const handleBookmark = useCallback(() => {
        setIsBookmarked((prev) => {
            const newValue = !prev;
            toast(newValue ? 'Article bookmarked' : 'Bookmark removed');
            return newValue;
        });
    }, []);

    const handleMenuPress = useCallback(() => {
        menuModalRef.current?.present();
    }, []);

    const handleCopyLink = useCallback(async () => {
        await Clipboard.setStringAsync(article.url);
        toast('Link copied to clipboard');
    }, [article.url]);

    const handleOpenInBrowser = useCallback(async () => {
        const supported = await Linking.canOpenURL(article.url);
        if (supported) {
            await Linking.openURL(article.url);
        } else {
            toast.error('Cannot open this URL');
        }
    }, [article.url]);

    const handleShare = useCallback(async () => {
        try {
            await Share.share({
                message: `${article.title}\n\n${article.url}`,
                url: article.url,
                title: article.title,
            });
        } catch (error) {
            toast.error('Failed to share article');
        }
    }, [article.title, article.url]);

    const handleSummarize = useCallback(async () => {
        if (aiSummary) {
            // If summary already exists, just scroll to it or show a toast
            toast('Summary already generated');
            return;
        }

        setIsLoadingSummary(true);
        menuModalRef.current?.dismiss();

        try {
            const summary = await generateMockSummary(article.title);
            setAiSummary(summary);
            toast.success('Summary generated');
        } catch (error) {
            toast.error('Failed to generate summary');
            setIsLoadingSummary(false);
        } finally {
            setIsLoadingSummary(false);
        }
    }, [article.title, aiSummary]);

    const handleCloseSummary = useCallback(() => {
        setAiSummary(undefined);
    }, []);

    const handleTranslate = useCallback(() => {
        toast('Translate feature coming soon');
    }, []);

    const handleWebModeChange = useCallback((enabled: boolean) => {
        toast(enabled ? 'Web Mode enabled' : 'Web Mode disabled');
    }, []);

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />

            {/* Top Action Bar */}
            <View className="flex-row items-center justify-between border-b border-light-grey px-4 py-3">
                {/* Close Button */}
                <Pressable
                    onPress={handleClose}
                    className="h-11 w-11 items-center justify-center rounded-full active:bg-mid-grey">
                    <Monicon name="lucide:x" size={20} color="#232222" />
                </Pressable>

                {/* Right Actions */}
                <View className="flex-row items-center gap-3">
                    {/* Share Button */}
                    <Pressable
                        onPress={handleShare}
                        className="h-11 w-11 items-center justify-center rounded-full active:bg-mid-grey">
                        <Monicon name="solar:share-outline" size={20} color="#232222" />
                    </Pressable>

                    {/* Bookmark Button */}
                    <Pressable
                        onPress={handleBookmark}
                        className="h-11 w-11 items-center justify-center rounded-full active:bg-mid-grey">
                        <Monicon
                            name={isBookmarked ? 'solar:bookmark-bold' : 'solar:bookmark-linear'}
                            size={20}
                            color={isBookmarked ? '#FBBC04' : '#232222'}
                        />
                    </Pressable>

                    {/* Menu Button */}
                    <Pressable
                        onPress={handleMenuPress}
                        className="h-11 w-11 items-center justify-center rounded-full active:bg-mid-grey">
                        <View style={{ transform: [{ rotate: '90deg' }] }}>
                            <Monicon name="solar:menu-dots-bold" size={20} color="#232222" />
                        </View>
                    </Pressable>
                </View>
            </View>

            {/* Article Content with Featured Image */}
            <ArticleReader
                article={article}
                aiSummary={aiSummary}
                isLoadingSummary={isLoadingSummary}
                onCloseSummary={handleCloseSummary}
            />

            {/* Menu Modal */}
            <ArticleMenuModal
                ref={menuModalRef}
                onCopyLink={handleCopyLink}
                onOpenInBrowser={handleOpenInBrowser}
                onSummarize={handleSummarize}
                onTranslate={handleTranslate}
                onWebModeChange={handleWebModeChange}
            />
        </SafeAreaView>
    );
}
