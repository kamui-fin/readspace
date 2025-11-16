import { cva } from 'class-variance-authority';

export const buttonVariants = cva('flex-row items-center justify-center relative overflow-hidden', {
  variants: {
    variant: {
      primary: 'bg-primary border-0',
      secondary: 'bg-grey6 dark:bg-grey5-dark border-0',
      text: 'bg-transparent border-0',
      ghost: 'bg-transparent border border-grey4 dark:border-grey4-dark',
      icon: 'bg-grey5 dark:bg-grey5-dark border-0',
    },
    size: {
      small: 'h-10 px-3',
      medium: 'h-12 px-4',
      large: 'h-14 px-5',
    },
    fullWidth: {
      true: 'w-full',
      false: 'w-auto',
    },
  },
  compoundVariants: [
    {
      variant: 'text',
      class: 'h-auto px-0 py-0 overflow-visible',
    },
    {
      variant: 'primary',
      class: 'rounded-xl',
    },
    {
      variant: 'secondary',
      class: 'rounded-xl',
    },
    {
      variant: 'ghost',
      class: 'rounded-xl',
    },
    {
      variant: 'icon',
      class: 'rounded-full',
    },
    {
      variant: 'icon',
      size: 'small',
      class: 'h-10 w-10 p-0',
    },
    {
      variant: 'icon',
      size: 'medium',
      class: 'h-12 w-12 p-0',
    },
    {
      variant: 'icon',
      size: 'large',
      class: 'h-14 w-14 p-0',
    },
  ],
  defaultVariants: {
    variant: 'primary',
    size: 'medium',
    fullWidth: true,
  },
});
