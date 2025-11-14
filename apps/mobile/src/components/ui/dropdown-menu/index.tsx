import { ComponentProps } from 'react';
import { Platform, ViewStyle, Text } from 'react-native';

import * as DropdownMenu from 'zeego/dropdown-menu';

const reversalWebIconStyle: ViewStyle = Platform.select({
  web: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-end',
  },
  default: {},
});

const DropdownMenuRoot = DropdownMenu.Root;

const DropdownMenuGroup = DropdownMenu.Group;

const DropdownMenuTrigger = DropdownMenu.Trigger;

const DropdownMenuSub = DropdownMenu.Sub;

const DropdownMenuSubContent = DropdownMenu.create(
  ({
    className,
    disableBlurEffect,
    ...props
  }: {
    className?: string;
    disableBlurEffect?: boolean;
  } & ComponentProps<typeof DropdownMenu.SubContent>) => (
    <DropdownMenu.SubContent
      align="end"
      {...props}
      className={`animate-zoom-in rounded-2xl p-2 shadow ${
        disableBlurEffect
          ? 'bg-white dark:bg-grey5-dark'
          : 'bg-white/80 shadow backdrop-blur-md backdrop-saturate-150 dark:bg-black/80'
      } ${className || ''}`}
    />
  ),
  'SubContent'
);

const DropdownMenuContent = DropdownMenu.create(
  ({
    className,
    disableBlurEffect,
    ...props
  }: {
    className?: string;
    disableBlurEffect?: boolean;
  } & ComponentProps<typeof DropdownMenu.Content>) => (
    <DropdownMenu.Content
      align="end"
      {...props}
      className={`animate-zoom-in rounded-2xl p-2 shadow ${
        disableBlurEffect
          ? 'bg-white dark:bg-grey5-dark'
          : 'bg-white/80 shadow backdrop-blur-md backdrop-saturate-150 dark:bg-black/80'
      } ${className || ''}`}
    />
  ),
  'Content'
);

const DropdownMenuItem = DropdownMenu.create(
  ({
    className,
    children,
    style,
    ...props
  }: { className?: string } & ComponentProps<typeof DropdownMenu.Item>) => {
    const combinedStyle =
      Platform.OS === 'web' ? ({ ...reversalWebIconStyle, ...(style as any) } as any) : style;

    return (
      <DropdownMenu.Item {...props} style={combinedStyle} className={className}>
        {children}
      </DropdownMenu.Item>
    );
  },
  'Item'
);

const DropdownMenuItemTitle = DropdownMenu.create(
  ({
    className,
    ...props
  }: { className?: string } & ComponentProps<typeof Text> &
    ComponentProps<typeof DropdownMenu.ItemTitle>) => (
    <DropdownMenu.ItemTitle {...props} className={className}>
      {props.children}
    </DropdownMenu.ItemTitle>
  ),
  'ItemTitle'
);

const DropdownMenuItemSubtitle = DropdownMenu.create(
  ({
    className,
    ...props
  }: { className?: string } & ComponentProps<typeof Text> &
    ComponentProps<typeof DropdownMenu.ItemSubtitle>) => (
    <DropdownMenu.ItemSubtitle {...props} className={className}>
      {props.children}
    </DropdownMenu.ItemSubtitle>
  ),
  'ItemSubtitle'
);

const DropdownMenuItemIndicator = DropdownMenu.create(
  ({
    className,
    ...props
  }: { className?: string } & ComponentProps<typeof DropdownMenu.ItemIndicator>) => (
    <DropdownMenu.ItemIndicator {...props} className={className} />
  ),
  'ItemIndicator'
);

const DropdownMenuSeparator = DropdownMenu.create(
  ({
    className,
    ...props
  }: { className?: string } & ComponentProps<typeof DropdownMenu.Separator>) => (
    <DropdownMenu.Separator
      {...props}
      className={`my-1 h-px bg-grey4 dark:bg-grey4-dark ${className || ''}`}
    />
  ),
  'Separator'
);

const DropdownMenuSubTrigger = DropdownMenu.create(
  ({
    className,
    children,
    style,
    ...props
  }: { className?: string } & ComponentProps<typeof DropdownMenu.SubTrigger>) => {
    const combinedStyle =
      Platform.OS === 'web' ? ({ ...reversalWebIconStyle, ...(style as any) } as any) : style;

    return (
      <DropdownMenu.SubTrigger {...props} style={combinedStyle} className={className}>
        {children}
      </DropdownMenu.SubTrigger>
    );
  },
  'SubTrigger'
);

const DropdownMenuItemIcon = DropdownMenu.create(
  ({
    className,
    ...props
  }: { className?: string } & ComponentProps<typeof DropdownMenu.ItemIcon>) => (
    <DropdownMenu.ItemIcon {...props} className={className} />
  ),
  'ItemIcon'
);

const DropdownMenuItemImage = DropdownMenu.create(
  ({
    className,
    ...props
  }: { className?: string } & ComponentProps<typeof DropdownMenu.ItemImage>) => (
    <DropdownMenu.ItemImage {...props} className={className} />
  ),
  'ItemImage'
);

const DropdownMenuLabel = DropdownMenu.create(
  ({ className, ...props }: { className?: string } & ComponentProps<typeof DropdownMenu.Label>) => (
    <DropdownMenu.Label
      {...props}
      className={`px-2 py-1.5 font-geist-semibold text-sm text-grey dark:text-grey-dark ${className || ''}`}
    />
  ),
  'Label'
);

const DropdownMenuArrow = DropdownMenu.Arrow;

const DropdownMenuCheckboxItem = DropdownMenu.CheckboxItem;

export {
  DropdownMenuRoot,
  DropdownMenuGroup,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemTitle,
  DropdownMenuItemSubtitle,
  DropdownMenuItemIndicator,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuItemIcon,
  DropdownMenuItemImage,
  DropdownMenuLabel,
  DropdownMenuArrow,
  DropdownMenuCheckboxItem,
};
