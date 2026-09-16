import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { POSITIVE, NEGATIVE } from '@/constants/colors';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

function smoothLinePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} L${points[1].x.toFixed(1)},${points[1].y.toFixed(1)}`;
  }
  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export const Sparkline = ({ data, width = 60, height = 30, color }: SparklineProps) => {
  if (!data || data.length < 2) return <View style={{ width, height }} />;

  const isPositive = data[data.length - 1] >= data[0];
  const resolvedColor = color ?? (isPositive ? POSITIVE : NEGATIVE);
  const gradientId = `spk-${isPositive ? 'g' : 'r'}`;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const padding = 2;
  const h = height - padding * 2;
  const range = max === min ? 1 : max - min;

  const points = data.map((val, i) => ({
    x: (i / (data.length - 1)) * width,
    y: max === min ? height / 2 : height - padding - ((val - min) / range) * h,
  }));

  const linePath = smoothLinePath(points);
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={resolvedColor} stopOpacity="0.3" />
            <Stop offset="1" stopColor={resolvedColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill={`url(#${gradientId})`} />
        <Path
          d={linePath}
          fill="none"
          stroke={resolvedColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};
