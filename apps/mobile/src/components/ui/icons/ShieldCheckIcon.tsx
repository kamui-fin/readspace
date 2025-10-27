import { Monicon, type MoniconProps } from '@monicon/native';

export interface ShieldCheckIconProps extends Omit<MoniconProps, 'name'> {
    size?: number;
    color?: string;
}

export function ShieldCheckIcon({ size = 24, color = '#90988B', ...props }: ShieldCheckIconProps) {
    return <Monicon name="solar:shield-check-linear" size={size} color={color} {...props} />;
}
