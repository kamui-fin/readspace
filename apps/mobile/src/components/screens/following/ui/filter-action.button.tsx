import { Button } from '@components/ui/button';
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItemIcon,
  DropdownMenuItemIndicator,
  DropdownMenuItemTitle,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { Monicon } from '@monicon/native';
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

  const handleFilterToggle = (selectedFilter: 'unread' | 'read') => {
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
        <DropdownMenuCheckboxItem
          key="unread"
          value={filter === 'unread' ? 'on' : 'off'}
          onValueChange={() => handleFilterToggle('unread')}
          className="px-4 py-3">
          <DropdownMenuItemIcon
            ios={{
              name: 'envelope.badge',
            }}
            androidIconName="mail_notification"
          />
          <DropdownMenuItemTitle size="lg" fontFamily="geist">
            Show unread only
          </DropdownMenuItemTitle>
          <DropdownMenuItemIndicator />
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          key="read"
          value={filter === 'read' ? 'on' : 'off'}
          onValueChange={() => handleFilterToggle('read')}
          className="px-4 py-3">
          <DropdownMenuItemIcon
            ios={{
              name: 'envelope.open',
            }}
            androidIconName="mail"
          />
          <DropdownMenuItemTitle size="lg" fontFamily="geist">
            Show read only
          </DropdownMenuItemTitle>
          <DropdownMenuItemIndicator />
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
}
