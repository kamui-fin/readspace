import type { ReactNode } from 'react';
import type { SharedValue } from 'react-native-reanimated';

export interface HeaderAction {
  label: string;
  onPress: () => void;
  icon: React.ComponentType<{
    width?: number;
    height?: number;
    color?: string;
    strokeWidth?: number;
  }>;
  disabled?: boolean;
}

export interface BaseHeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  actions?: HeaderAction[];
  bottomContent?: ReactNode; // Content to render below title (e.g., search bar)
  titleFontWeight?: 'bold' | 'semibold'; // Font weight for title
}

export interface StaticHeaderProps extends BaseHeaderProps {
  variant: 'static';
  scrollY?: never;
  scrollDirection?: never;
  onHeaderHeightChange?: never;
  activeTab?: never;
  onTabChange?: never;
  showSort?: never;
  onSortPress?: never;
  actionButton?: never;
}

export interface StickyHeaderProps extends BaseHeaderProps {
  variant: 'sticky';
  scrollY?: SharedValue<number>;
  scrollDirection?: SharedValue<'up' | 'down'>;
  onHeaderHeightChange?: (height: number) => void;
  onTitlePress?: () => void; // Make title clickable
  activeTab?: never;
  onTabChange?: never;
  showSort?: never;
  onSortPress?: never;
  actionButton?: never;
}

export interface TabbedHeaderProps extends BaseHeaderProps {
  variant: 'tabbed';
  scrollY: SharedValue<number>;
  onHeaderHeightChange?: (height: number) => void;
  activeTab?: number;
  onTabChange?: (index: number) => void;
  showSort?: boolean;
  onSortPress?: () => void;
  actionButton?: ReactNode;
  onTitlePress?: () => void; // Make title clickable
}

export type HeaderProps = StaticHeaderProps | StickyHeaderProps | TabbedHeaderProps;
