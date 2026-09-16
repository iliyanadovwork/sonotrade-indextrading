import Svg, { Path } from 'react-native-svg';
import { POSITIVE as POS, NEGATIVE as NEG } from '@/constants/colors';

export function TrendArrow({ positive, size = 10 }: { positive: boolean; size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 14"
      style={{ alignSelf: 'center', marginTop: 1, transform: [{ rotate: positive ? '0deg' : '180deg' }] }}
    >
      <Path fill={positive ? POS : NEG} d="m12 0 10.392 14.25H1.608z" />
    </Svg>
  );
}

export const trendColor = (positive: boolean) => (positive ? POS : NEG);
