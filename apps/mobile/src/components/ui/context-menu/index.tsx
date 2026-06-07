import { Text, type TextSize } from '@components/ui/text';
import { cva } from 'class-variance-authority';
import clsx from 'clsx';
import type { ComponentProps } from 'react';
import { Platform, type ViewStyle } from 'react-native';
import * as ContextMenu from 'zeego/context-menu';

const reversalWebIconStyle: ViewStyle = Platform.select({
  web: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-end',
  },
  default: {},
});

const ContextMenuRoot = ContextMenu.Root;

const ContextMenuGroup = ContextMenu.Group;

const ContextMenuTrigger = ContextMenu.Trigger;

const ContextMenuSub = ContextMenu.Sub;

const contextMenuContentVariants = cva('animate-zoom-in rounded-2xl p-2 shadow', {
  variants: {
    disableBlurEffect: {
      true: 'bg-white dark:bg-black ',
      false: 'bg-white/80 shadow backdrop-blur-md backdrop-saturate-150 dark:bg-black/80',
    },
  },
  defaultVariants: {
    disableBlurEffect: false,
  },
});

const ContextMenuSubContent = ContextMenu.create(
  ({
    className,
    disableBlurEffect,
    ...props
  }: {
    className?: string;
    disableBlurEffect?: boolean;
  } & ComponentProps<typeof ContextMenu.SubContent>) => (
    <ContextMenu.SubContent
      {...props}
      className={clsx(contextMenuContentVariants({ disableBlurEffect }), className)}
    />
  ),
  'SubContent'
);

const ContextMenuContent = ContextMenu.create(
  ({
    className,
    disableBlurEffect,
    ...props
  }: {
    className?: string;
    disableBlurEffect?: boolean;
  } & ComponentProps<typeof ContextMenu.Content>) => (
    <ContextMenu.Content
      {...props}
      className={clsx(contextMenuContentVariants({ disableBlurEffect }), className)}
    />
  ),
  'Content'
);

const ContextMenuItem = ContextMenu.create(
  ({
    className,
    children,
    style,
    ...props
  }: { className?: string } & ComponentProps<typeof ContextMenu.Item>) => {
    return (
      <ContextMenu.Item
        {...props}
        style={[reversalWebIconStyle, style].filter(Boolean) as any}
        className={className}>
        {children}
      </ContextMenu.Item>
    );
  },
  'Item'
);

const ContextMenuItemTitle = ContextMenu.create(
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
  } & ComponentProps<typeof ContextMenu.ItemTitle>) => {
    const content =
      size || fontFamily ? (
        <Text size={size} fontFamily={fontFamily} className={className}>
          {children}
        </Text>
      ) : (
        children
      );

    return (
      <ContextMenu.ItemTitle {...props} className={className}>
        {content}
      </ContextMenu.ItemTitle>
    );
  },
  'ItemTitle'
);

const ContextMenuItemSubtitle = ContextMenu.create(
  ({
    className,
    ...props
  }: { className?: string } & ComponentProps<typeof Text> &
    ComponentProps<typeof ContextMenu.ItemSubtitle>) => (
    <ContextMenu.ItemSubtitle {...props} className={className}>
      {props.children}
    </ContextMenu.ItemSubtitle>
  ),
  'ItemSubtitle'
);

const ContextMenuItemIndicator = ContextMenu.create(
  ({
    className,
    ...props
  }: { className?: string } & ComponentProps<typeof ContextMenu.ItemIndicator>) => (
    <ContextMenu.ItemIndicator {...props} className={className} />
  ),
  'ItemIndicator'
);

const ContextMenuSeparator = ContextMenu.create(
  ({
    className,
    ...props
  }: { className?: string } & ComponentProps<typeof ContextMenu.Separator>) => (
    <ContextMenu.Separator {...props} className={clsx('bg-grey4 my-1 h-px ', className)} />
  ),
  'Separator'
);

const ContextMenuSubTrigger = ContextMenu.create(
  ({
    className,
    children,
    style,
    ...props
  }: { className?: string } & ComponentProps<typeof ContextMenu.SubTrigger>) => {
    return (
      <ContextMenu.SubTrigger
        {...props}
        style={[reversalWebIconStyle, style].filter(Boolean) as any}
        className={className}>
        {children}
      </ContextMenu.SubTrigger>
    );
  },
  'SubTrigger'
);

const ContextMenuItemIcon = ContextMenu.create(
  ({
    className,
    ...props
  }: { className?: string } & ComponentProps<typeof ContextMenu.ItemIcon>) => (
    <ContextMenu.ItemIcon {...props} className={className} />
  ),
  'ItemIcon'
);

const ContextMenuItemImage = ContextMenu.create(
  ({
    className,
    ...props
  }: { className?: string } & ComponentProps<typeof ContextMenu.ItemImage>) => (
    <ContextMenu.ItemImage {...props} className={className} />
  ),
  'ItemImage'
);

const ContextMenuLabel = ContextMenu.create(
  ({ className, ...props }: { className?: string } & ComponentProps<typeof ContextMenu.Label>) => (
    <ContextMenu.Label
      {...props}
      className={clsx('font-geist-semibold text-grey px-2 py-1.5 text-sm ', className)}
    />
  ),
  'Label'
);

const ContextMenuPreview = ContextMenu.Preview;

const ContextMenuCheckboxItem = ContextMenu.CheckboxItem;

export {
  ContextMenuRoot,
  ContextMenuGroup,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuItemTitle,
  ContextMenuItemSubtitle,
  ContextMenuItemIndicator,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuItemIcon,
  ContextMenuItemImage,
  ContextMenuLabel,
  ContextMenuPreview,
  ContextMenuCheckboxItem,
};
