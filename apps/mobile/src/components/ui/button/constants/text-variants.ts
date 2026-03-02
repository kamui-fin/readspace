import { cva } from 'class-variance-authority';

export const textVariants = cva('text-center leading-tight', {
  variants: {
    variant: {
      primary: 'text-white',
      secondary: 'text-grey dark:text-grey',
      text: 'text-primary dark:text-primary',
      ghost: 'text-primary-foreground dark:text-primary-foreground-dark',
      icon: 'text-primary-foreground dark:text-primary-foreground-dark',
    },
    size: {
      small: 'text-sm font-geist-medium leading-5',
      medium: 'text-base font-geist-medium leading-5',
      large: 'text-lg font-geist-semibold leading-6',
    },
    hasIcon: {
      true: '',
      false: '',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'medium',
    hasIcon: false,
  },
});
