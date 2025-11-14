import Svg, { Path } from 'react-native-svg';

export interface ExpandVerticalIconProps {
  size?: number;
  color?: string;
}

export function ExpandVerticalIcon({ size = 24, color = 'currentColor' }: ExpandVerticalIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="M13.616 8.884a1.25 1.25 0 0 0 1.768-1.768l-1.952-1.952c-.083-.083-.19-.19-.294-.279a1.8 1.8 0 0 0-.597-.342a1.75 1.75 0 0 0-1.082 0c-.276.09-.474.238-.597.342a5 5 0 0 0-.294.279L8.616 7.116a1.25 1.25 0 1 0 1.768 1.768L12 7.268zm-3.232 6.232a1.25 1.25 0 1 0-1.768 1.768l1.952 1.952c.083.083.19.19.294.279c.123.104.32.252.597.342c.352.114.73.114 1.082 0c.276-.09.474-.238.597-.342c.104-.089.211-.196.294-.279l1.952-1.952a1.25 1.25 0 0 0-1.768-1.768L12 16.732z"
      />
    </Svg>
  );
}
