import { Monicon, type MoniconProps } from '@monicon/native';

export interface MailIconProps extends Omit<MoniconProps, 'name'> {
    size?: number;
    color?: string;
}

export function MailIcon({ size = 24, color = '#90988B', ...props }: MailIconProps) {
    return <Monicon name="solar:mailbox-linear" size={size} color={color} {...props} />;
}
