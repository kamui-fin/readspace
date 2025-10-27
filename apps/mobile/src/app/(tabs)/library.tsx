import { BookCard } from '@/components/BookCard';
import { FilterPicker, type BookFilter } from '@/components/FilterPicker';
import { SortPicker, type SortBy, type SortOrder } from '@/components/SortPicker';
import { FAB } from '@/components/ui/FAB';
import BottomSheet from '@gorhom/bottom-sheet';
import { Monicon } from '@monicon/native';
import * as DocumentPicker from 'expo-document-picker';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

// Mock book data
const MOCK_BOOKS = [
  {
    id: '1',
    title: 'Moby Dick',
    coverUrl: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1327940656i/153747.jpg',
    pagesLeft: 95,
    isCompleted: false,
  },
  {
    id: '2',
    title: 'The Great Gatsby',
    coverUrl: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1490528560i/4671.jpg',
    pagesLeft: 0,
    isCompleted: true,
  },
  {
    id: '3',
    title: '1984',
    coverUrl: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1657781256i/61439040.jpg',
    pagesLeft: 203,
    isCompleted: false,
  },
  {
    id: '4',
    title: 'Pride and Prejudice',
    coverUrl: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1320399351i/1885.jpg',
    pagesLeft: 312,
    isCompleted: false,
  },
  {
    id: '5',
    title: 'To Kill a Mockingbird',
    coverUrl: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1553383690i/2657.jpg',
    pagesLeft: 0,
    isCompleted: true,
  },
  {
    id: '6',
    title: 'The Catcher in the Rye',
    coverUrl: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1398034300i/5107.jpg',
    pagesLeft: 145,
    isCompleted: false,
  },
  {
    id: '7',
    title: 'Brave New World',
    coverUrl: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1575509280i/5129.jpg',
    pagesLeft: 67,
    isCompleted: false,
  },
  {
    id: '8',
    title: 'The Hobbit',
    coverUrl: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1546071216i/5907.jpg',
    pagesLeft: 0,
    isCompleted: true,
  },
  {
    id: '9',
    title: 'Jane Eyre',
    coverUrl: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1557343311i/10210.jpg',
    pagesLeft: 278,
    isCompleted: false,
  },
  {
    id: '10',
    title: 'Wuthering Heights',
    coverUrl: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1388212715i/6185.jpg',
    pagesLeft: 189,
    isCompleted: false,
  },
  {
    id: '11',
    title: 'The Odyssey',
    coverUrl: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1390173285i/1381.jpg',
    pagesLeft: 425,
    isCompleted: false,
  },
  {
    id: '12',
    title: 'Crime and Punishment',
    coverUrl: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1382846449i/7144.jpg',
    pagesLeft: 0,
    isCompleted: true,
  },
];

export default function Library() {
  const sortPickerRef = useRef<BottomSheet>(null);
  const filterPickerRef = useRef<BottomSheet>(null);
  const [sortBy, setSortBy] = useState<SortBy>('lastRead');
  const [sortOrder, setSortOrder] = useState<SortOrder>('descending');
  const [filter, setFilter] = useState<BookFilter>('none');

  const handleSortPress = () => {
    sortPickerRef.current?.snapToIndex(0);
  };

  const handleFilterPress = () => {
    filterPickerRef.current?.snapToIndex(0);
  };

  const handleSortChange = (newSortBy: SortBy, newOrder: SortOrder) => {
    setSortBy(newSortBy);
    setSortOrder(newOrder);
    toast(`Sorted by ${newSortBy} (${newOrder})`);
  };

  const handleFilterChange = (newFilter: BookFilter) => {
    setFilter(newFilter);
    if (newFilter !== 'none') {
      toast(`Filtered by ${newFilter}`);
    } else {
      toast('Filter cleared');
    }
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
        // TODO: Process the EPUB file and add to library
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

  // Filter and sort books based on current settings
  const filteredBooks = MOCK_BOOKS.filter((book) => {
    if (filter === 'none') return true;
    if (filter === 'completed') return book.isCompleted;
    if (filter === 'inProgress') return !book.isCompleted && book.pagesLeft > 0;
    if (filter === 'notStarted') return !book.isCompleted && book.pagesLeft === 0;
    return true;
  });

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between mb-2">
          <Text className="font-geist-bold text-3xl tracking-heading text-black">
            My Bookshelf
          </Text>
          <View className="flex-row gap-3">
            <Pressable
              onPress={handleSortPress}
              className="h-10 w-10 items-center justify-center rounded-full transition-opacity active:opacity-80">
              <Monicon name="solar:sort-linear" size={24} color="#232222" />
            </Pressable>
            <Pressable
              onPress={handleFilterPress}
              className="h-10 w-10 items-center justify-center rounded-full transition-opacity active:opacity-80">
              <Monicon name="solar:filter-linear" size={24} color="#232222" />
            </Pressable>
          </View>
        </View>
        <Text className="mb-6 font-geist text-base text-grey">
          {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'}
        </Text>

        <View className="flex-row flex-wrap justify-between pb-24">
          {filteredBooks.map((book) => (
            <View key={book.id} className="mb-6 w-[48%]">
              <BookCard
                title={book.title}
                coverUrl={book.coverUrl}
                pagesLeft={book.pagesLeft}
                isCompleted={book.isCompleted}
                onPress={() => toast(`Open ${book.title}`)}
              />
            </View>
          ))}
        </View>
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
