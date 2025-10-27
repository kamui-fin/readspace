import { Monicon, type MoniconProps } from '@monicon/native';

export interface LibraryIconProps extends Omit<MoniconProps, 'name'> {
    size?: number;
    color?: string;
}

export function LibraryIcon({ size = 24, color = '#90988B', ...props }: LibraryIconProps) {
    return <Monicon name="solar:library-outline" size={size} color={color} {...props} />;
}
