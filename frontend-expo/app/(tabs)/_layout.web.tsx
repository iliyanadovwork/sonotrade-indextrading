import React, { useEffect } from 'react';
import { Slot, usePathname, useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors } from '@/constants/theme';

const BG = Colors.dark.background;
const BORDER = '#1c1c1e';
const ACTIVE = '#fff';
const INACTIVE = '#71717a';
const TAB_H = 60;

function SocialIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="9" cy="7" r="4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function TradeIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M22 7 13.5 15.5 8.5 10.5 2 17M16 7h6v6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function PortfolioIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const TABS = [
  { name: 'social',    path: '/social',    label: 'Social',    Icon: SocialIcon },
  { name: 'trade',     path: '/trade',     label: 'Trade',     Icon: TradeIcon },
  { name: 'search',    path: '/search',    label: 'Discover',  Icon: SearchIcon },
  { name: 'portfolio', path: '/portfolio', label: 'Portfolio', Icon: PortfolioIcon },
];

export default function TabLayoutWeb() {
  const pathname = usePathname();
  const router = useRouter();

  // Scroll to top when switching tabs
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: BG }}>
      {/* Content — scrolls with the document */}
      <div style={{ paddingBottom: `calc(${TAB_H}px + env(safe-area-inset-bottom, 0px))` }}>
        <Slot />
      </div>

      {/* Fixed tab bar */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'row',
          backgroundColor: BG,
          borderTop: `1px solid ${BORDER}`,
          height: `calc(${TAB_H}px + env(safe-area-inset-bottom, 0px))`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          zIndex: 100,
        }}
      >
        {TABS.map(({ name, path, label, Icon }) => {
          const active = pathname === path || (name === 'trade' && (pathname === '/' || pathname === ''));
          const color = active ? ACTIVE : INACTIVE;
          return (
            <button
              key={name}
              onClick={() => router.push(path as any)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column' as const,
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                gap: 3,
                padding: '8px 0 4px',
                WebkitTapHighlightColor: 'transparent',
              } as React.CSSProperties}
            >
              <Icon color={color} />
              <span
                style={{
                  color,
                  fontSize: 10,
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
                  userSelect: 'none',
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
