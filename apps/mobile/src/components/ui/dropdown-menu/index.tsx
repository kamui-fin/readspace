import { Text, type TextSize } from '@components/ui/text';
import { cva } from 'class-variance-authority';
import clsx from 'clsx';
import type { ComponentProps } from 'react';
import { Platform, type ViewStyle } from 'react-native';
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

const dropdownMenuContentVariants = cva('animate-zoom-in rounded-2xl p-2 shadow', {
  variants: {
    disableBlurEffect: {
      true: 'bg-white dark:bg-grey5-dark',
      false: 'bg-white/80 shadow backdrop-blur-md backdrop-saturate-150 dark:bg-black/80',
    },
  },
  defaultVariants: {
    disableBlurEffect: false,
  },
});

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
      className={clsx(dropdownMenuContentVariants({ disableBlurEffect }), className)}
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
      className={clsx(dropdownMenuContentVariants({ disableBlurEffect }), className)}
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
    return (
      <DropdownMenu.Item
        {...props}
        style={[reversalWebIconStyle, style].filter(Boolean) as any}
        className={className}>
        {children}
      </DropdownMenu.Item>
    );
  },
  'Item'
);

const DropdownMenuItemTitle = DropdownMenu.create(
  ({
    className,
    size,
    fontFamily,
    children,
    ...props
  }: {
    className?: string;
    size?: TextSize;
    fontFamily?:
    | 'geist'
    | 'geist-medium'
    | 'geist-semibold'
    | 'geist-bold'
    | 'mono'
    | 'mono-medium'
    | 'mono-semibold'
    | 'mono-bold'
    | 'figtree'
    | 'figtree-medium'
    | 'figtree-semibold'
    | 'figtree-bold'
    | 'garamond'
    | 'garamond-medium'
    | 'garamond-semibold'
    | 'garamond-bold';
  } & ComponentProps<typeof DropdownMenu.ItemTitle>) => {
    // If size or fontFamily props are provided, wrap in Text component
    // Otherwise, pass through to let ItemTitle handle rendering
    const content =
      size || fontFamily ? (
        <Text size={size} fontFamily={fontFamily} className={className}>
          {children}
        </Text>
      ) : (
        children
      );

    return (
      <DropdownMenu.ItemTitle {...props} className={className}>
        {content}
      </DropdownMenu.ItemTitle>
    );
  },
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
      className={clsx('my-1 h-px bg-grey4 dark:bg-grey4-dark', className)}
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
    return (
      <DropdownMenu.SubTrigger
        {...props}
        style={[reversalWebIconStyle, style].filter(Boolean) as any}
        className={className}>
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
      className={clsx(
        'px-2 py-1.5 font-geist-semibold text-sm text-grey dark:text-grey-dark',
        className
      )}
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
