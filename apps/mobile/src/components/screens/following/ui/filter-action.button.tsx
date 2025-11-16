import { Button } from '@components/ui/button';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemTitle,
  DropdownMenuItemIcon,
} from '@components/ui/dropdown-menu';
import { Monicon } from '@monicon/native';
import { COLORS } from '@lib/constants/colors';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import type { ArticleFilter } from '@stores/following';

interface FilterActionButtonProps {
  filter: ArticleFilter;
  onFilterChange: (filter: ArticleFilter) => void;
}

export function FilterActionButton({ filter, onFilterChange }: FilterActionButtonProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  // Determine icon and color based on current filter
  const getFilterIcon = () => {
    switch (filter) {
      case 'unread':
        return 'solar:letter-unread-bold';
      case 'read':
        return 'solar:letter-opened-bold';
      case 'read_later':
        return 'solar:bookmark-bold';
      default:
        return 'solar:filter-bold';
    }
  };

  const getFilterColor = () => {
    if (filter === 'all') {
      return colors.grey2;
    }
    return colors.secondary;
  };

  const getButtonBackgroundColor = () => {
    if (filter === 'all') {
      return colors.grey5;
    }
    // Use muted green background when filter is active
    return colors.muted_green;
  };

  const handleFilterToggle = (selectedFilter: 'unread' | 'read' | 'read_later') => {
    // If the filter is already selected, toggle it off (set to "all")
    // Otherwise, set it to the selected filter
    if (filter === selectedFilter) {
      onFilterChange('all');
    } else {
      onFilterChange(selectedFilter);
    }
  };

  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="small"
          fullWidth={false}
          className="min-h-9 rounded-full px-3 py-2"
          style={{
            backgroundColor: getButtonBackgroundColor(),
          }}>
          <Monicon name={getFilterIcon()} size={16} color={getFilterColor()} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem key="unread" onSelect={() => handleFilterToggle('unread')}>
          <DropdownMenuItemIcon
            ios={{
              name: filter === 'unread' ? 'envelope.badge.fill' : 'envelope.badge',
            }}
            androidIconName="mail_notification"
          />
          <DropdownMenuItemTitle>Show unread only</DropdownMenuItemTitle>
        </DropdownMenuItem>
        <DropdownMenuItem key="read" onSelect={() => handleFilterToggle('read')}>
          <DropdownMenuItemIcon
            ios={{
              name: filter === 'read' ? 'envelope.open.fill' : 'envelope.open',
            }}
            androidIconName={filter === 'read' ? 'drafts' : 'mail'}
          />
          <DropdownMenuItemTitle>Show read only</DropdownMenuItemTitle>
        </DropdownMenuItem>
        <DropdownMenuItem key="read_later" onSelect={() => handleFilterToggle('read_later')}>
          <DropdownMenuItemIcon
            ios={{
              name: filter === 'read_later' ? 'clock.badge.fill' : 'clock.badge',
            }}
            androidIconName={filter === 'read_later' ? 'bookmark' : 'bookmark_border'}
          />
          <DropdownMenuItemTitle>Show recents</DropdownMenuItemTitle>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
}
