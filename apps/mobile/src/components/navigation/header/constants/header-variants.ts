import { cva } from 'class-variance-authority';

export const headerContainerVariants = cva('w-full bg-background ', {
  variants: {
    variant: {
      static: 'relative', // Static position, not absolute
      sticky: '',
      tabbed: '', // Position handled dynamically via animated style
    },
  },
  defaultVariants: {
    variant: 'sticky',
  },
});

export const foregroundVariants = cva('flex-row items-center pb-3', {
  variants: {
    layout: {
      default: 'justify-between px-4',
      centered: 'justify-center',
    },
  },
  defaultVariants: {
    layout: 'default',
  },
});

export const titleContainerVariants = cva('', {
  variants: {
    layout: {
      default: 'flex-1 max-w-[70%]',
      centered: 'items-center',
    },
  },
  defaultVariants: {
    layout: 'default',
  },
});

export const titleVariants = cva(
  'leading-8 text-primary-foreground dark:text-primary-foreground-dark tracking-tight',
  {
    variants: {
      fontWeight: {
        bold: 'font-geist-bold',
        semibold: 'font-geist-semibold',
      },
      size: {
        default: 'text-3xl',
        medium: 'text-2xl',
        small: 'text-xl',
      },
    },
    defaultVariants: {
      fontWeight: 'bold',
      size: 'default',
    },
  }
);

export const subtitleVariants = cva(
  'font-geist-medium text-lg text-grey2 dark:text-grey2 mt-1 opacity-80'
);

export const actionsContainerVariants = cva('flex-row items-center gap-3');

export const tabsRowVariants = cva(
  'flex-row justify-between items-center px-4 py-2 gap-3 w-full bg-background '
);

export const tabsContainerVariants = cva('flex-row items-center justify-between flex-1');

export const tabsGroupVariants = cva('flex-row items-center gap-1.5');
