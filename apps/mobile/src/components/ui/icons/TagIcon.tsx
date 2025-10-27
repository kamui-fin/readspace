import { Monicon, type MoniconProps } from '@monicon/native';

export interface TagIconProps extends Omit<MoniconProps, 'name'> {
    size?: number;
    color?: string;
}

export function TagIcon({ size = 24, color = '#90988B', ...props }: TagIconProps) {
    return <Monicon name="solar:tag-outline" size={size} color={color} {...props} />;
}
