import { Monicon, type MoniconProps } from '@monicon/native';

export interface LockIconProps extends Omit<MoniconProps, 'name'> {
    size?: number;
    color?: string;
}

export function LockIcon({ size = 24, color = '#90988B', ...props }: LockIconProps) {
    return <Monicon name="solar:lock-keyhole-linear" size={size} color={color} {...props} />;
}
