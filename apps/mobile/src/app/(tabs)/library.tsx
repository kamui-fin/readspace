import { BookCard } from '@/components/BookCard';
import { FilterPicker, type BookFilter } from '@/components/FilterPicker';
import { SortPicker, type SortBy, type SortOrder } from '@/components/SortPicker';
import { BookCardSkeleton } from '@/components/skeletons';
import { FAB } from '@/components/ui/FAB';
import { COLORS } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthProvider';
import BottomSheet from '@gorhom/bottom-sheet';
import { Monicon } from '@monicon/native';
import { useBooks, type UserBookLibrary } from '@readspace/shared';
import * as DocumentPicker from 'expo-document-picker';
import { useColorScheme } from 'nativewind';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

export default function Library() {
    const { user } = useAuth();
    const { colorScheme } = useColorScheme();
    const colors = COLORS[colorScheme ?? 'light'];
    const sortPickerRef = useRef<BottomSheet>(null);
    const filterPickerRef = useRef<BottomSheet>(null);
    const [sortBy, setSortBy] = useState<SortBy>('lastRead');
    const [sortOrder, setSortOrder] = useState<SortOrder>('descending');
    const [filter, setFilter] = useState<BookFilter>('none');

    // Fetch books data
    const { data: booksData, isLoading } = useBooks(user?.id || '');
    const books = (booksData as UserBookLibrary[]) || [];

    const handleSortPress = () => {
        sortPickerRef.current?.snapToIndex(0);
    };

    const handleFilterPress = () => {
        filterPickerRef.current?.snapToIndex(0);
    };

    const handleSortChange = (newSortBy: SortBy, newOrder: SortOrder) => {
        setSortBy(newSortBy);
        setSortOrder(newOrder);
        // Sort order immediately visible in UI, no toast needed
    };

    const handleFilterChange = (newFilter: BookFilter) => {
        setFilter(newFilter);
        // Filter changes immediately visible in list, no toast needed
    };

    const handleAddBook = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/epub+zip',
                copyToCacheDirectory: true,
                multiple: false,
            });

            if (result.canceled) {
                return;
            }

            const file = result.assets[0];
            if (file) {
                toast.success(`Selected: ${file.name}`, {
                    description: 'EPUB file ready to import',
                });
                // TODO: Implement book upload API
                console.log('EPUB file selected:', {
                    name: file.name,
                    uri: file.uri,
                    size: file.size,
                    mimeType: file.mimeType,
                });
            }
        } catch (error) {
            console.error('Error picking document:', error);
            toast.error('Failed to select file', {
                description: 'Please try again',
            });
        }
    };

    // Helper function to calculate progress percentage
    const getBookProgress = (book: UserBookLibrary): number => {
        if (
            book.book_metadata.format === 'PDF' &&
            book.pdf_current_page !== null &&
            book.book_metadata.num_pages
        ) {
            return Math.round((book.pdf_current_page / book.book_metadata.num_pages) * 100);
        } else if (book.book_metadata.format === 'EPUB' && book.epub_progress) {
            // Parse epub_progress if needed
            const progress = book.epub_progress as {
                globalProgress?: { current: number; total: number };
            };
            if (progress?.globalProgress) {
                return Math.round(
                    (progress.globalProgress.current / progress.globalProgress.total) * 100
                );
            }
        }
        return 0;
    };

    // Filter and sort books based on current settings
    const filteredBooks = useMemo(() => {
        let result = books.filter((book) => {
            if (filter === 'none') return true;
            const progress = getBookProgress(book);
            if (filter === 'completed') return progress === 100;
            if (filter === 'inProgress') return progress > 0 && progress < 100;
            if (filter === 'notStarted') return progress === 0;
            return true;
        });

        // Sort books
        result.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'lastRead':
                    comparison =
                        new Date(b.date_added).getTime() - new Date(a.date_added).getTime();
                    break;
                case 'title':
                    comparison = a.book_metadata.title.localeCompare(b.book_metadata.title);
                    break;
                default:
                    comparison = 0;
            }

            return sortOrder === 'ascending' ? comparison : -comparison;
        });

        return result;
    }, [books, filter, sortBy, sortOrder]);

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-white-dark" edges={['top']}>
                <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
                    <View className="mb-2 flex-row items-center justify-between">
                        <Text className="font-geist-bold text-3xl tracking-heading text-black dark:text-black-dark">
                            My Bookshelf
                        </Text>
                        <View className="flex-row gap-3">
                            <View className="h-10 w-10" />
                            <View className="h-10 w-10" />
                        </View>
                    </View>
                    <View className="mb-6 h-6 w-20 rounded-md bg-mid-grey dark:bg-mid-grey-dark" />
                    <View className="flex-row flex-wrap justify-between pb-24">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <View key={index} className="mb-6 w-[48%]">
                                <BookCardSkeleton />
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-white-dark" edges={['top']}>
            <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
                <View className="mb-2 flex-row items-center justify-between">
                    <Text className="font-geist-bold text-3xl tracking-heading text-black dark:text-black-dark">
                        My Bookshelf
                    </Text>
                    <View className="flex-row gap-3">
                        <Pressable
                            onPress={handleSortPress}
                            className="h-10 w-10 items-center justify-center rounded-full transition-opacity active:opacity-80">
                            <Monicon name="solar:sort-linear" size={24} color={colors.black} />
                        </Pressable>
                        <Pressable
                            onPress={handleFilterPress}
                            className="h-10 w-10 items-center justify-center rounded-full transition-opacity active:opacity-80">
                            <Monicon name="solar:filter-linear" size={24} color={colors.black} />
                        </Pressable>
                    </View>
                </View>
                <Text className="mb-6 font-geist text-base text-grey dark:text-grey-dark">
                    {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'}
                </Text>

                {filteredBooks.length === 0 ? (
                    <View className="flex-1 items-center justify-center py-12">
                        <Text className="text-center text-base text-grey dark:text-grey-dark">
                            No books in your library yet
                        </Text>
                    </View>
                ) : (
                    <View className="flex-row flex-wrap justify-between pb-24">
                        {filteredBooks.map((book) => {
                            const progress = getBookProgress(book);
                            const totalPages = book.book_metadata.num_pages || 0;
                            const pagesLeft = totalPages
                                ? Math.ceil(totalPages * (1 - progress / 100))
                                : 0;
                            return (
                                <View key={book.id} className="mb-6 w-[48%]">
                                    <BookCard
                                        title={book.book_metadata.title}
                                        coverUrl={book.book_metadata.cover_url || undefined}
                                        pagesLeft={pagesLeft}
                                        isCompleted={progress === 100}
                                        onPress={() => toast(`Open ${book.book_metadata.title}`)}
                                    />
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            <View className="absolute bottom-6 right-4">
                <FAB onPress={handleAddBook} />
            </View>

            <SortPicker
                ref={sortPickerRef}
                onSortChange={handleSortChange}
                initialSortBy={sortBy}
                initialOrder={sortOrder}
            />

            <FilterPicker
                ref={filterPickerRef}
                onFilterChange={handleFilterChange}
                initialFilter={filter}
            />
        </SafeAreaView>
    );
}
