import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import type { ReactNode } from 'react';

export interface DiscoverScrollContextType {
  scrollY?: SharedValue<number>;
  scrollDirection?: SharedValue<'up' | 'down'>;
  setScrollValues?: (
    scrollY: SharedValue<number>,
    scrollDirection: SharedValue<'up' | 'down'>
  ) => void;
  searchBar?: ReactNode;
  setSearchBar?: (searchBar: ReactNode) => void;
  headerHeight?: number;
  setHeaderHeight?: (height: number) => void;
  similarFeedsScrollValues?: {
    scrollY: SharedValue<number>;
    scrollDirection: SharedValue<'up' | 'down'>;
  } | null;
  setSimilarFeedsScrollValues?: (
    scrollY: SharedValue<number>,
    scrollDirection: SharedValue<'up' | 'down'>
  ) => void;
  similarFeedsTitle?: string;
  setSimilarFeedsTitle?: (title: string) => void;
  recentsScrollValues?: {
    scrollY: SharedValue<number>;
    scrollDirection: SharedValue<'up' | 'down'>;
  } | null;
  setRecentsScrollValues?: (
    scrollY: SharedValue<number>,
    scrollDirection: SharedValue<'up' | 'down'>
  ) => void;
  recentsHeaderHeight?: number;
  setRecentsHeaderHeight?: (height: number) => void;
}

export const DiscoverScrollContext = createContext<DiscoverScrollContextType>({});

export const useDiscoverScroll = () => useContext(DiscoverScrollContext);
