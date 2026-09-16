import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, StatusBar, Platform, UIManager, Modal, TextInput, Pressable, KeyboardAvoidingView, Animated, Easing, Alert, Image, PanResponder, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { GlyphDrawLoader } from '@/components/GlyphDrawLoader';
import { TradePanel } from '@/components/TradePanel';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { useAuth } from '@/context/AuthContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Rect, Line as SvgLine } from 'react-native-svg';
import { LinearGradient as FadeGradient } from 'expo-linear-gradient';
const AnimatedPath = Animated.createAnimatedComponent(Path);
import { ENDPOINTS } from '@/constants/API';
import { useFetch } from '@/hooks/useFetch';
import CommentSection from '@/components/CommentSection';
import { Colors } from '@/constants/theme';
import { POSITIVE as COLOR_GREEN, NEGATIVE as COLOR_RED } from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_MARGIN_RIGHT = 24;
const CHART_WIDTH = SCREEN_WIDTH - CHART_MARGIN_RIGHT;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface DataPoint {
  index: number;
  timestamp: string;
}

interface Release {
  id: string;
  name: string;
  url?: string;
  type?: string;
  image?: string;
  date?: string;
  tracks?: number;
}

interface TopTrack {
  id: string;
  name: string;
  album?: string;
  image?: string;
  url?: string;
  artists?: string[] | string;
  playcount?: number;
}

interface TopCity {
  city: string;
  country?: string;
  numberOfListeners?: number;
}

interface ArtistEvent {
  id: string | string[];
  url?: string;
  date: string;
  name: string;
  venue: string;
  location: string;
}

interface ArtistDetail {
  name: string;
  index_price: number;
  mark_price: number;
  change_1h: number;
  change_1d: number;
  change_1w: number;
  last_updated: string;
  data_points: DataPoint[];
  image_url?: string | null;
  biography?: string | null;
  gallery?: string[] | null;
  followers?: number | null;
  monthly_listeners?: number | null;
  facebook?: string | null;
  instagram?: string | null;
  twitter?: string | null;
  tiktok?: string | null;
  releases?: Release[];
  top_tracks?: TopTrack[];
  top_cities?: TopCity[];
  events?: ArtistEvent[];
}

interface Position {
  id: string;
  artist_name: string;
  position_type: 'long' | 'short';
  contracts: number;
  entry_price: number;
  total_cost: number;
}

interface OpenOrder {
  id: string;
  side: 'buy' | 'sell';
  order_type: string;
  price: number;
  quantity: number;
  filled_quantity: number;
  remaining_quantity: number;
  status: string;
  created_at: string;
}

interface ShareData {
  artistName: string;
  contracts: number;
  position: 'long' | 'short';
  profitLoss: number;
  entryPrice: number;
  currentPrice: number;
  username: string;
}

interface ArtistResponse {
  artist: ArtistDetail;
}

const PERIOD_MS: Record<string, number> = {
  '1H': 60 * 60 * 1000,
  '1D': 24 * 60 * 60 * 1000,
  '1W': 7 * 24 * 60 * 60 * 1000,
  '1M': 30 * 24 * 60 * 60 * 1000,
  '1Y': 365 * 24 * 60 * 60 * 1000,
};

function useTradeData(spotify_id: string, token: string | null) {
  const [positions, setPositions] = useState<Position[]>([]);

  const refetch = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(ENDPOINTS.TRADES.MY_POSITIONS(spotify_id), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setPositions(d.trades || []);
      }
    } catch (e) {
      console.error('Error fetching trade data:', e);
    }
  }, [spotify_id, token]);

  useEffect(() => {
    refetch();
    const inv = setInterval(refetch, 5000);
    return () => clearInterval(inv);
  }, [refetch]);

  return { positions, refetch };
}

function useChartData(rawPoints: DataPoint[], activeTab: string) {
  const nowMsRef = useRef(Date.now());

  useEffect(() => {
    nowMsRef.current = Date.now();
  }, [activeTab]);

  return useMemo(() => {
    const nowMs = nowMsRef.current;
    const allDataPoints = [...rawPoints].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const oldestTimestamp = allDataPoints[0] ? new Date(allDataPoints[0].timestamp).getTime() : 0;
    const cutoffTime = activeTab === 'ALL' ? 0 : nowMs - (PERIOD_MS[activeTab] ?? 0);

    let chartPoints: typeof allDataPoints;
    let chartStartTime: number;

    if (activeTab === 'ALL' || cutoffTime < oldestTimestamp) {
      chartPoints = allDataPoints;
      chartStartTime = oldestTimestamp;
    } else {
      const inWindow = allDataPoints.filter(p => new Date(p.timestamp).getTime() >= cutoffTime);
      const lastBefore = [...allDataPoints].reverse().find(p => new Date(p.timestamp).getTime() < cutoffTime);
      const anchor = lastBefore
        ? [{ ...lastBefore, timestamp: new Date(cutoffTime).toISOString() }]
        : [];
      chartPoints = [...anchor, ...inWindow];
      chartStartTime = cutoffTime;
    }

    const latestInWindow = chartPoints[chartPoints.length - 1];
    const latestMs = latestInWindow ? new Date(latestInWindow.timestamp).getTime() : 0;
    const extendToMs = Math.max(nowMs, latestMs + 1);
    const chartPointsWithNow = latestInWindow
      ? [...chartPoints, { ...latestInWindow, timestamp: new Date(extendToMs).toISOString() }]
      : chartPoints;

    const lastChartPoint = allDataPoints[allDataPoints.length - 1];
    const chartData = chartPointsWithNow.map(p => p.index);
    const chartTimestamps = chartPointsWithNow.map(p => new Date(p.timestamp).getTime());
    const startPrice = chartPointsWithNow[0]?.index ?? 0;
    const endPrice = lastChartPoint?.index ?? 0;

    return { allDataPoints, chartData, chartTimestamps, chartStartTime, startPrice, endPrice };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawPoints, activeTab]);
}

function BlinkingDot({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity }} />;
}

export default function ArtistScreen() {
  const insets = useSafeAreaInsets();
  const { spotify_id, image: _pi, price: _pp, change: _pc, rank: _rank, name: _pn } = useLocalSearchParams<{ spotify_id: string; image?: string; price?: string; change?: string; rank?: string; name?: string; }>();
  const previewImage = _pi ? decodeURIComponent(_pi) : null;
  const previewName = _pn ? decodeURIComponent(_pn) : null;
  const previewPrice = parseFloat(_pp || '0') || 0;
  const previewChange = parseFloat(_pc || '0') || 0;
  const previewRank = _rank ? parseInt(_rank) : null;
  const router = useRouter();
  const { data, loading, error } = useFetch<ArtistResponse>(ENDPOINTS.ARTIST(spotify_id));
  const [polledData, setPolledData] = useState<ArtistResponse | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState('ALL');
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [isTradePanelVisible, setIsTradePanelVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ type: 'position' | 'order', data: any } | null>(null);
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<any>(null);
  const commentsOffsetY = useRef(0);
  const [chartMode, setChartMode] = useState<'line' | 'candle'>('line');
  const [disclaimerHeight, setDisclaimerHeight] = useState(90);

  const { positions, refetch: fetchTradeData } = useTradeData(spotify_id, token);

  const artist = (polledData ?? data)?.artist ?? null;
  const { allDataPoints, chartData, chartTimestamps, chartStartTime, startPrice, endPrice } =
    useChartData(artist?.data_points ?? [], activeTab);

  useEffect(() => {
    if (loading) return;
    if ((data?.artist?.data_points?.length ?? 0) > 0) return;
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${ENDPOINTS.ARTIST(spotify_id)}?_t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json: ArtistResponse = await res.json();
        if ((json.artist?.data_points?.length ?? 0) > 0) {
          setPolledData(json);
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        }
      } catch {}
    }, 2000);
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [loading, data]);

  if (loading && !data) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <GlyphDrawLoader />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error loading artist: {error?.message || 'Not found'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const COLOR_ZINC = '#71717a';

  const displayName = artist?.name ?? previewName ?? decodeURIComponent(spotify_id);
  const displayImageUrl = artist?.image_url ?? previewImage;
  const displayPrice = artist?.index_price ?? previewPrice;

  const periodChange = (allDataPoints.length > 0 && startPrice > 0)
    ? ((endPrice - startPrice) / startPrice) * 100
    : previewChange;
  const rawChange = allDataPoints.length > 0 ? endPrice - startPrice : 0;

  const isUp = periodChange >= 0;
  const mainColor = isUp ? COLOR_GREEN : COLOR_RED;
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={[styles.navBar, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonNav}>
           <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
             <Path d="M15 18l-6-6 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
           </Svg>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={styles.navRightIcons}>
          <TouchableOpacity style={styles.moreButtonNav}>
             <Svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
               <Path d="M6 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
             </Svg>
          </TouchableOpacity>
          <TouchableOpacity style={styles.copyButtonNav}>
             <Svg width="18" height="18" viewBox="0 0 23.5 23.5" fill="none">
               <Path 
                 d="m7.62 15.879 8.26-8.257M4.53 10.718l-2.07 2.064a5.84 5.84 0 1 0 8.26 8.257l2.06-2.064M10.72 4.524l2.06-2.064a5.84 5.84 0 1 1 8.26 8.258l-2.06 2.064" 
                 stroke="#fff" 
                 strokeWidth="1.5" 
                 strokeLinecap="round" 
                 strokeLinejoin="round" 
               />
             </Svg>
          </TouchableOpacity>
        </View>
      </View>

      {/* Disclaimer — fixed behind scroll content */}
      <Animated.View style={{
        position: 'absolute', top: insets.top + 44, left: 16, right: 16, zIndex: 1,
        opacity: scrollY.interpolate({ inputRange: [0, disclaimerHeight * 0.7], outputRange: [1, 0], extrapolate: 'clamp' }),
      }}>
        <View style={styles.disclaimerCard} onLayout={e => setDisclaimerHeight(e.nativeEvent.layout.height)}>
          <Text style={styles.disclaimerTitle}>⚠ Paper Trading Only</Text>
          <Text style={styles.disclaimerText}>
            Sonotrade is a derivatives paper trading platform. All positions, profits, and losses are simulated and carry no real monetary value. No real assets are bought or sold.
          </Text>
        </View>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollViewRef}
        style={{ backgroundColor: 'transparent' }}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 44 + disclaimerHeight + 20 }]}
        bounces={false}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        <View style={{ backgroundColor: Colors.dark.background }}>
        {/* Artist Name Header */}
        <View style={styles.nameHeader}>
          {displayImageUrl ? (
            <Image source={{ uri: displayImageUrl }} style={styles.artistAvatar} />
          ) : (
            <View style={styles.artistAvatarPlaceholder} />
          )}
          <Text style={styles.largeName}>{displayName}</Text>
        </View>

        {/* Main Price Headline */}
        <View style={styles.headlineContainer}>
          <View style={styles.priceRow}>
            <AnimatedNumber value={hoverValue ?? displayPrice} style={styles.headlinePrice} />
            <Text style={styles.headlineLabel}>points</Text>
          </View>

          <View style={styles.changeContainer}>
            <Svg
              width="14"
              height="14"
              viewBox="0 0 24 14"
              style={{ transform: [{ rotate: isUp ? '0deg' : '180deg' }] }}
            >
              <Path d="m12 0 10.392 14.25H1.608z" fill={mainColor} />
            </Svg>
            <Text style={[styles.changeValueText, { color: mainColor }]}>
              {Math.abs(periodChange).toFixed(2)}%
            </Text>
            <Text style={[styles.changeValueText, { color: mainColor }]}>
              ({isUp ? '+' : '-'}${Math.abs(rawChange).toFixed(3)})
            </Text>
          </View>
        </View>

      {/* Chart */}
      <View style={styles.chartArea}>
        {allDataPoints.length === 0 ? (
          <View style={{ width: CHART_WIDTH, height: 270, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <GlyphDrawLoader width={20} />
            <Text style={{ color: '#52525b', fontSize: 11 }}>Fetching chart data…</Text>
          </View>
        ) : (
          <BigChart
            key={polledData !== null ? 1 : 0}
            data={chartData}
            timestamps={chartTimestamps}
            startTime={chartStartTime}
            color={mainColor}
            onValueChange={setHoverValue}
            releases={artist?.releases}
            chartMode={chartMode}
            activePeriod={activeTab}
          />
        )}
      </View>

      {/* Time Controls + Action Icons */}
      <View style={styles.timeControlsRow}>
        <View style={styles.timeSelectGroup}>
          {['1D', '1W', '1M', '1Y', 'ALL'].map(period => (
            <TouchableOpacity
              key={period}
              onPress={() => setActiveTab(period)}
              style={styles.periodBtn}
            >
              <Text style={[styles.periodBtnText, activeTab === period && { color: '#fff' }]}>
                {period}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.headerActions}>
          {/* Candlestick toggle */}
          <TouchableOpacity
            onPress={() => setChartMode(m => m === 'line' ? 'candle' : 'line')}
            style={[styles.headerActionBtn, chartMode === 'candle' && styles.headerActionBtnActive]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Svg width={15} height={15} viewBox="0 0 24 24">
              <Path fill={chartMode === 'candle' ? '#000' : '#fff'} d="M7.5 4.5H7.25V2C7.25 1.59 6.91 1.25 6.5 1.25C6.09 1.25 5.75 1.59 5.75 2V4.5H5.5C3.91 4.5 3 5.41 3 7V13C3 14.59 3.91 15.5 5.5 15.5H5.75V22C5.75 22.41 6.09 22.75 6.5 22.75C6.91 22.75 7.25 22.41 7.25 22V15.5H7.5C9.09 15.5 10 14.59 10 13V7C10 5.41 9.09 4.5 7.5 4.5Z" />
              <Path fill={chartMode === 'candle' ? '#000' : '#fff'} d="M18.5 8.5H18.25V2C18.25 1.59 17.91 1.25 17.5 1.25C17.09 1.25 16.75 1.59 16.75 2V8.5H16.5C14.91 8.5 14 9.41 14 11V17C14 18.59 14.91 19.5 16.5 19.5H16.75V22C16.75 22.41 17.09 22.75 17.5 22.75C17.91 22.75 18.25 22.41 18.25 22V19.5H18.5C20.09 19.5 21 18.59 21 17V11C21 9.41 20.09 8.5 18.5 8.5Z" />
            </Svg>
          </TouchableOpacity>

          {/* Comments */}
          <TouchableOpacity
            onPress={() => scrollViewRef.current?.scrollTo({ y: commentsOffsetY.current, animated: true })}
            style={styles.headerActionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
              <Path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity
            onPress={async () => {
              try {
                const canShare = await Sharing.isAvailableAsync();
                if (canShare) await Sharing.shareAsync(`https://sonotrade.com/artist/${spotify_id}`);
              } catch {}
            }}
            style={styles.headerActionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Svg viewBox="0 0 24 24" width={18} height={18}>
              <Path fill="#fff" d="M12 2.59L17.7 8.29L16.29 9.71L13 6.41V16H11V6.41L7.7 9.71L6.29 8.29L12 2.59ZM21 15L20.98 18.51C20.98 19.89 19.86 21 18.48 21H5.5C4.11 21 3 19.88 3 18.5V15H5V18.5C5 18.78 5.22 19 5.5 19H18.48C18.76 19 18.98 18.78 18.98 18.5L19 15H21Z" />
            </Svg>
          </TouchableOpacity>
        </View>
      </View>

      {/* Action Button - Trade */}
      <View style={styles.actionContainer}>
        <TouchableOpacity 
          style={[styles.actionBtn, { backgroundColor: '#fff' }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            // guests get the sign-in (welcome) screen instead of the trade panel
            if (!token) router.push('/welcome?back=1');
            else setIsTradePanelVisible(true);
          }}
        >
          <Text style={[styles.actionBtnText, { color: '#000' }]}>Trade</Text>
        </TouchableOpacity>
      </View>

      <TradePanel
        isVisible={isTradePanelVisible}
        onClose={() => setIsTradePanelVisible(false)}
        artistName={displayName}
        spotifyId={spotify_id}
        price={displayPrice}
        color={mainColor}
        imageUrl={displayImageUrl}
      />

      <View style={styles.dropdownsContainer}>
        <AccordionSection title="Important Information">
          <Text style={styles.infoText}>
            The {displayName} Perpetual-Style Futures Contract is a cash-settled, 5-year perpetual-style contract that trades continuously and allows participants to gain or reduce exposure to changes in the underlying performance of the artist {displayName}. The underlying index aggregates anonymized signals from sources such as Spotify performance, search activity, and social media engagement, providing a financial value based on real-world performance metrics. Each contract represents a fixed unit of the {displayName} Index. The contract incorporates a periodic funding mechanism designed to keep prices closely aligned with the index level over time. Positions are settled in cash rather than any underlying media or intellectual property.
          </Text>
        </AccordionSection>

        {/* Positions and Orders */}
        <View style={styles.tradeGroups}>
          <View style={styles.tradeSection}>
            <Text style={styles.tradeSectionTitle}>Active Positions</Text>
            {positions.length > 0 ? positions.map(pos => (
              <TouchableOpacity
                key={pos.id}
                style={[styles.tradeRow, { borderBottomWidth: 0 }]}
                onPress={() => {
                  setSelectedItem({ type: 'position', data: pos });
                  setIsDetailsVisible(true);
                }}
              >
                <View style={styles.tradeRowSide}>
                  <BlinkingDot color={pos.position_type === 'long' ? COLOR_GREEN : COLOR_RED} />
                  <Text style={styles.tradeRowText}>{pos.position_type.toUpperCase()}</Text>
                </View>
                <Text style={styles.tradeRowText}>{pos.contracts} contracts</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.tradeRowValue}>${(pos.contracts * displayPrice).toFixed(2)}</Text>
                  {(() => {
                    const pnl = (displayPrice - pos.entry_price) * (pos.position_type === 'long' ? 1 : -1) * pos.contracts;
                    return (
                      <Text style={[styles.tradeRowSub, { color: pnl >= 0 ? COLOR_GREEN : COLOR_RED }]}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                      </Text>
                    );
                  })()}
                </View>
              </TouchableOpacity>
            )) : (
              <Text style={styles.emptyText}>No positions</Text>
            )}
          </View>

        </View>


      </View>

      {/* Artist Info Sections */}
      {artist && (artist.biography || (artist.releases?.length ?? 0) > 0 || (artist.top_tracks?.length ?? 0) > 0 || (artist.top_cities?.length ?? 0) > 0 || (artist.events?.length ?? 0) > 0) && (
        <View style={{ marginHorizontal: 16 }}>
          {artist.biography && (
            <>
              <View style={{ paddingVertical: 24 }}>
                <AboutSection
                  biography={artist.biography}
                  followers={artist.followers}
                  monthly_listeners={artist.monthly_listeners}
                  facebook={artist.facebook}
                  instagram={artist.instagram}
                  twitter={artist.twitter}
                  tiktok={artist.tiktok}
                  spotifyId={spotify_id}
                />
              </View>
              <View style={{ height: 1, backgroundColor: '#1c1c1e' }} />
            </>
          )}
          {(artist.releases?.length ?? 0) > 0 && (
            <>
              <View style={{ paddingVertical: 24 }}>
                <ReleasesSection releases={artist.releases!} />
              </View>
              <View style={{ height: 1, backgroundColor: '#1c1c1e' }} />
            </>
          )}
          {(artist.top_tracks?.length ?? 0) > 0 && (
            <>
              <View style={{ paddingVertical: 24 }}>
                <TopTracksSection tracks={artist.top_tracks!} />
              </View>
              <View style={{ height: 1, backgroundColor: '#1c1c1e' }} />
            </>
          )}
          {(artist.top_cities?.length ?? 0) > 0 && (
            <>
              <View style={{ paddingVertical: 24 }}>
                <TopCitiesSection cities={artist.top_cities!} scrollY={scrollY} />
              </View>
              {(artist.events?.length ?? 0) > 0 && <View style={{ height: 1, backgroundColor: '#1c1c1e' }} />}
            </>
          )}
          {(artist.events?.length ?? 0) > 0 && (
            <View style={{ paddingVertical: 24 }}>
              <UpcomingShowsSection events={artist.events!} artistName={displayName} />
            </View>
          )}
        </View>
      )}

      <View onLayout={e => { commentsOffsetY.current = e.nativeEvent.layout.y; }}>
        <CommentSection artistName={displayName} spotifyId={spotify_id} />
      </View>

      <View style={{ height: 60 }} />
      </View>
      </Animated.ScrollView>
      <TradeDetailsModal
        isVisible={isDetailsVisible}
        onClose={() => setIsDetailsVisible(false)}
        item={selectedItem}
        artistPrice={displayPrice}
        onRefresh={fetchTradeData}
        onShare={(data) => { setIsDetailsVisible(false); setShareData({ ...data, username: user?.username || 'Trader' }); }}
      />
      {shareData && (
        <SharePositionSheet data={shareData} onClose={() => setShareData(null)} />
      )}
    </View>
  );
}


function AccordionSection({ title, children }: { title: string, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: isOpen ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isOpen]);

  const maxHeight = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1000], // Large enough to cover content
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <View style={styles.accordionContainer}>
      <TouchableOpacity 
        style={styles.accordionHeader} 
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.7}
      >
        <Text style={styles.accordionTitle}>{title}</Text>
        <Animated.View 
          style={{ 
            transform: [{ rotate: animatedValue.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '180deg']
            })}] 
          }}
        >
          <Svg 
            width="12" 
            height="12" 
            viewBox="0 0 24 24" 
          >
            <Path d="M19 9l-7 7-7-7" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      </TouchableOpacity>
      
      <Animated.View style={[styles.accordionContent, { maxHeight, opacity, overflow: 'hidden' }]}>
        {children}
      </Animated.View>
    </View>
  );
}

function TradeDetailsModal({ isVisible, onClose, item, artistPrice, onRefresh, onShare }: {
  isVisible: boolean;
  onClose: () => void;
  item: any;
  artistPrice: number;
  onRefresh: () => void;
  onShare?: (data: { artistName: string; contracts: number; position: 'long' | 'short'; profitLoss: number; entryPrice: number; currentPrice: number }) => void;
}) {
  const { token } = useAuth();
  const [isActioning, setIsActioning] = useState(false);

  if (!item) return null;

  const handleAction = async () => {
    if (!token) return;
    setIsActioning(true);
    try {
      const url = ENDPOINTS.TRADES.CLOSE;
      const body = JSON.stringify({ spotify_id: item.data.spotify_id });

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body
      });

      if (res.ok) {
        onRefresh();
        onClose();
      } else {
        const d = await res.json();
        Alert.alert('Error', d.error || 'Action failed');
      }
    } catch (e) {
      Alert.alert('Error', 'Network request failed');
    } finally {
      setIsActioning(false);
    }
  };

  const isPosition = item.type === 'position';
  const data = item.data;
  const posSideMul = isPosition && data.position_type === 'long' ? 1 : -1;
  const unrealizedPnl = isPosition ? (artistPrice - data.entry_price) * posSideMul * data.contracts : 0;

  return (
    <Modal visible={isVisible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.bottomSheet} onStartShouldSetResponder={() => true}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{isPosition ? 'Position Details' : 'Order Details'}</Text>
          </View>

          <View style={styles.sheetContent}>
            <View style={styles.detailGroup}>
              {isPosition ? (
                <>
                  <DetailRow
                    label="Side"
                    value={data.position_type.toUpperCase()}
                    valueColor={data.position_type === 'long' ? COLOR_GREEN : COLOR_RED}
                  />
                  <DetailRow label="Contracts" value={String(data.contracts)} />
                  <DetailRow label="Entry (avg)" value={`$${data.entry_price.toFixed(2)}`} />
                  <DetailRow label="Total Entry" value={`$${data.total_cost.toFixed(2)}`} />
                  <DetailRow label="Current" value={`$${artistPrice.toFixed(2)}`} />
                  <DetailRow label="Market Value" value={`$${(data.contracts * artistPrice).toFixed(2)}`} />
                  <DetailRow label="Funding" value="$0.00" />
                  <DetailRow
                    label="Unrealized PnL"
                    value={`${unrealizedPnl >= 0 ? '+' : ''}$${unrealizedPnl.toFixed(2)}`}
                    valueColor={unrealizedPnl >= 0 ? COLOR_GREEN : COLOR_RED}
                  />
                </>
              ) : (
                <>
                  <DetailRow label="Date" value={new Date(data.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} />
                  <DetailRow
                    label="Side"
                    value={data.side === 'buy' ? 'LONG' : 'SHORT'}
                    valueColor={data.side === 'buy' ? COLOR_GREEN : COLOR_RED}
                  />
                  <DetailRow label="Type" value={data.order_type.toUpperCase()} />
                  <DetailRow label="Price" value={`$${data.price.toFixed(2)}`} />
                  <DetailRow label="Filled / Total" value={`${data.filled_quantity} / ${data.quantity}`} />
                  <DetailRow label="Status" value={data.status.toUpperCase()} />
                </>
              )}
            </View>

            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={styles.closeTradeBtn}
                onPress={handleAction}
                disabled={isActioning}
              >
                <Text style={styles.closeTradeBtnText}>
                  {isActioning ? 'Processing...' : (isPosition ? 'Close Position' : 'Cancel Order')}
                </Text>
              </TouchableOpacity>

              {isPosition && onShare && (
                <TouchableOpacity
                  style={[styles.closeTradeBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#3f3f46' }]}
                  onPress={() => onShare({
                    artistName: data.artist_name,
                    contracts: data.contracts,
                    position: data.position_type,
                    profitLoss: unrealizedPnl,
                    entryPrice: data.entry_price,
                    currentPrice: artistPrice,
                  })}
                >
                  <Text style={[styles.closeTradeBtnText, { color: '#fff' }]}>Share Position</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function SharePositionSheet({ data, onClose }: { data: ShareData; onClose: () => void }) {
  const isProfitable = data.profitLoss >= 0;
  const cardRef = useRef<View>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleShare = async () => {
    if (!cardRef.current) return;
    setIsCapturing(true);
    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      } else {
        Alert.alert('Sharing not available on this device');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not capture image');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={shareStyles.sheet} onStartShouldSetResponder={() => true}>
          <View style={shareStyles.sheetHeader}>
            <View style={shareStyles.handle} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 16 }}>
              <Text style={shareStyles.title}>Share your position</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={{ color: '#71717a', fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ paddingHorizontal: 16 }}>
            {/* Card — captured as image */}
            <View ref={cardRef} style={shareStyles.card} collapsable={false}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={shareStyles.traderLabel}>Trader</Text>
                  <Text style={shareStyles.traderName}>{data.username}</Text>
                </View>
                <View style={shareStyles.contractsPill}>
                  <Text style={shareStyles.contractsText}>{data.contracts} contract{data.contracts !== 1 ? 's' : ''}</Text>
                </View>
              </View>

              <View style={shareStyles.positionBox}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={shareStyles.posLabel}>I'm {data.position}</Text>
                    <Text style={shareStyles.posArtist}>{data.artistName}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={shareStyles.pnlLabel}>Unrealized PnL</Text>
                    <Text style={[shareStyles.pnlValue, { color: isProfitable ? COLOR_GREEN : COLOR_RED }]}>
                      {isProfitable ? '+' : ''}${data.profitLoss.toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={shareStyles.divider} />
                <View style={{ flexDirection: 'row', gap: 24 }}>
                  <View>
                    <Text style={shareStyles.statLabel}>Entry</Text>
                    <Text style={shareStyles.statVal}>${data.entryPrice.toFixed(2)}</Text>
                  </View>
                  <View>
                    <Text style={shareStyles.statLabel}>Current</Text>
                    <Text style={shareStyles.statVal}>${data.currentPrice.toFixed(2)}</Text>
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Image source={require('@/assets/images/st-glyph.png')} style={{ width: 24, height: 24, opacity: 0.5 }} />
                  <Text style={shareStyles.brandName}>Sonotrade</Text>
                </View>
                <Text style={shareStyles.brandUrl}>index.sonotrade.io</Text>
              </View>
            </View>

            {/* Footer */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
              <Text style={{ color: '#71717a', fontSize: 12 }}>Share your position card as an image.</Text>
              <TouchableOpacity style={shareStyles.shareBtn} onPress={handleShare} disabled={isCapturing}>
                {isCapturing ? (
                  <GlyphDrawLoader width={20} />
                ) : (
                  <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                )}
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ height: 40 }} />
        </View>
      </Pressable>
    </Modal>
  );
}

function DetailRow({ label, value, valueColor = '#fff' }: { label: string, value: string, valueColor?: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function MetricRow({ label, value, last }: { label: string, value: string, last?: boolean }) {
  return (
    <View style={[styles.metricRow, last && { paddingBottom: 20 }]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

// ─── Artist Info Sections ─────────────────────────────────────────────────────

const SECTION_PER_PAGE = 3;
const SECTION_W = SCREEN_WIDTH - 32;
const BAR_MAX_W = SCREEN_WIDTH - 32;
const SHOW_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function decodeHtml(str: string): string {
  if (!str) return '';
  let s = str.replace(/<[^>]+>/g, '');
  s = s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;|&#34;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
  s = s.replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => { try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return ''; } });
  s = s.replace(/&#(\d+);/g, (_, dec) => { try { return String.fromCodePoint(parseInt(dec, 10)); } catch { return ''; } });
  return s;
}

function formatNumber(n: number): string { return n.toLocaleString('en-US'); }

function formatListeners(count?: number): string {
  if (count == null) return '';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return `${count}`;
}

function formatPlaycount(count?: number): string {
  if (count == null) return '';
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)}B streams`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M streams`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K streams`;
  return `${count} streams`;
}


function PaginatedSectionHeader({ title, page, totalPages, onPrev, onNext }: {
  title: string; page: number; totalPages: number; onPrev: () => void; onNext: () => void;
}) {
  return (
    <View style={sectionStyles.header}>
      <Text style={sectionStyles.sectionTitle}>{title}</Text>
      {totalPages > 1 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={onPrev} disabled={page === 0} style={[sectionStyles.arrowBtn, page === 0 && { opacity: 0.4 }]}>
            <Svg viewBox="0 0 24 24" width={16} height={16}>
              <Path fill={page === 0 ? '#52525b' : '#a1a1aa'} d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </Svg>
          </TouchableOpacity>
          <Text style={sectionStyles.pageLabel}>{page + 1} of {totalPages}</Text>
          <TouchableOpacity onPress={onNext} disabled={page >= totalPages - 1} style={[sectionStyles.arrowBtn, page >= totalPages - 1 && { opacity: 0.4 }]}>
            <Svg viewBox="0 0 24 24" width={16} height={16}>
              <Path fill={page >= totalPages - 1 ? '#52525b' : '#a1a1aa'} d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
            </Svg>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function AboutSection({ biography, followers, monthly_listeners, facebook, instagram, twitter, tiktok, spotifyId }: {
  biography: string;
  followers?: number | null;
  monthly_listeners?: number | null;
  facebook?: string | null;
  instagram?: string | null;
  twitter?: string | null;
  tiktok?: string | null;
  spotifyId?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const bio = decodeHtml(biography);
  const socials = [
    { label: 'Facebook', url: facebook },
    { label: 'Instagram', url: instagram },
    { label: 'X (Twitter)', url: twitter },
    { label: 'TikTok', url: tiktok },
  ].filter(s => s.url);

  return (
    <View>
      <View style={sectionStyles.header}>
        <Text style={sectionStyles.sectionTitle}>About</Text>
      </View>
      {bio ? (
        <>
          <Text style={sectionStyles.bioText} numberOfLines={expanded ? undefined : 3}>{bio}</Text>
          <TouchableOpacity onPress={() => setExpanded(e => !e)} style={{ marginTop: 6 }}>
            <Text style={sectionStyles.showMore}>{expanded ? 'Show less' : 'Show more'}</Text>
          </TouchableOpacity>
        </>
      ) : null}
      {expanded && (followers != null || monthly_listeners != null || socials.length > 0 || spotifyId) && (
        <View style={{ marginTop: 16, gap: 12 }}>
          {(followers != null || monthly_listeners != null) && (
            <View style={{ flexDirection: 'row', gap: 24 }}>
              {followers != null && (
                <View>
                  <Text style={sectionStyles.statValue}>{formatNumber(followers)}</Text>
                  <Text style={sectionStyles.statLabel}>Followers</Text>
                </View>
              )}
              {monthly_listeners != null && (
                <View>
                  <Text style={sectionStyles.statValue}>{formatNumber(monthly_listeners)}</Text>
                  <Text style={sectionStyles.statLabel}>Monthly Listeners</Text>
                </View>
              )}
            </View>
          )}
          {socials.length > 0 && (
            <View style={{ gap: 8 }}>
              {socials.map(s => (
                <TouchableOpacity key={s.label} onPress={() => Linking.openURL(s.url!)}>
                  <Text style={sectionStyles.socialLink}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {spotifyId && (
            <TouchableOpacity onPress={() => Linking.openURL(`https://open.spotify.com/artist/${spotifyId}`)}>
              <Text style={sectionStyles.socialLink}>Open in Spotify ↗</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function SwipeSection({ totalPages, page, onPageChange, renderPage }: {
  totalPages: number;
  page: number;
  onPageChange: (p: number) => void;
  renderPage: (pi: number) => React.ReactNode;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollXAnim = useRef(new Animated.Value(0)).current;
  const userScrolling = useRef(false);

  useEffect(() => {
    if (!userScrolling.current) {
      scrollRef.current?.scrollTo({ x: page * SECTION_W, animated: true });
    }
  }, [page]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      decelerationRate="fast"
      directionalLockEnabled
      nestedScrollEnabled
      onScrollBeginDrag={() => { userScrolling.current = true; }}
      onScroll={e => scrollXAnim.setValue(e.nativeEvent.contentOffset.x)}
      onScrollEndDrag={e => {
        const vx = Math.abs((e.nativeEvent.velocity as any)?.x ?? 0);
        if (vx < 0.1) {
          // Slow drag with no momentum — pagingEnabled won't fire onMomentumScrollEnd, snap manually
          userScrolling.current = false;
          const idx = Math.max(0, Math.min(totalPages - 1, Math.round(e.nativeEvent.contentOffset.x / SECTION_W)));
          scrollRef.current?.scrollTo({ x: idx * SECTION_W, animated: true });
          onPageChange(idx);
        }
        // Fast flick: let pagingEnabled + onMomentumScrollEnd handle snapping
      }}
      onMomentumScrollEnd={e => {
        userScrolling.current = false;
        const idx = Math.max(0, Math.min(totalPages - 1, Math.round(e.nativeEvent.contentOffset.x / SECTION_W)));
        onPageChange(idx);
      }}
    >
      {Array.from({ length: totalPages }, (_, pi) => {
        const inputRange = [(pi - 1) * SECTION_W, pi * SECTION_W, (pi + 1) * SECTION_W];
        const opacity = scrollXAnim.interpolate({
          inputRange,
          outputRange: [0, 1, 0],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View key={pi} style={{ width: SECTION_W, opacity }}>
            {renderPage(pi)}
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

function ReleasesSection({ releases }: { releases: Release[] }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(releases.length / SECTION_PER_PAGE);

  return (
    <View>
      <PaginatedSectionHeader title="Releases" page={page} totalPages={totalPages}
        onPrev={() => setPage(p => Math.max(0, p - 1))}
        onNext={() => setPage(p => Math.min(totalPages - 1, p + 1))}
      />
      <SwipeSection totalPages={totalPages} page={page} onPageChange={setPage} renderPage={pi => {
        const items = releases.slice(pi * SECTION_PER_PAGE, (pi + 1) * SECTION_PER_PAGE);
        return items.map((r, i) => {
          const year = r.date ? (() => { try { const y = new Date(r.date!).getFullYear(); return isNaN(y) ? '' : String(y); } catch { return ''; } })() : '';
          const meta = [r.type ? r.type.charAt(0).toUpperCase() + r.type.slice(1).toLowerCase() : null, year, r.tracks != null ? `${r.tracks} track${r.tracks === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ');
          const content = (
            <View style={sectionStyles.row}>
              <View style={sectionStyles.thumb}>
                {r.image ? <Image source={{ uri: r.image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : <View style={sectionStyles.thumbPlaceholder} />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={sectionStyles.rowTitle} numberOfLines={1}>{r.name}</Text>
                {meta ? <Text style={sectionStyles.rowSub}>{meta}</Text> : null}
              </View>
            </View>
          );
          return r.url ? (
            <TouchableOpacity key={i} onPress={() => Linking.openURL(r.url!)} activeOpacity={0.7}>{content}</TouchableOpacity>
          ) : <View key={i}>{content}</View>;
        });
      }} />
    </View>
  );
}

function TopTracksSection({ tracks }: { tracks: TopTrack[] }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(tracks.length / SECTION_PER_PAGE);

  return (
    <View>
      <PaginatedSectionHeader title="Top Tracks" page={page} totalPages={totalPages}
        onPrev={() => setPage(p => Math.max(0, p - 1))}
        onNext={() => setPage(p => Math.min(totalPages - 1, p + 1))}
      />
      <SwipeSection totalPages={totalPages} page={page} onPageChange={setPage} renderPage={pi => {
        const items = tracks.slice(pi * SECTION_PER_PAGE, (pi + 1) * SECTION_PER_PAGE);
        return items.map((t, i) => {
          const trackUrl = t.url || (t.id ? `https://open.spotify.com/track/${t.id}` : undefined);
          const artists = Array.isArray(t.artists) ? t.artists.join(', ') : (t.artists ?? '');
          const playcount = formatPlaycount(t.playcount);
          const content = (
            <View style={sectionStyles.row}>
              <View style={sectionStyles.thumb}>
                {t.image ? <Image source={{ uri: t.image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : <View style={sectionStyles.thumbPlaceholder} />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={sectionStyles.rowTitle} numberOfLines={1}>{t.name}</Text>
                {artists ? <Text style={sectionStyles.rowSub} numberOfLines={1}>{artists}</Text> : null}
              </View>
              {playcount ? <Text style={sectionStyles.rowRight}>{playcount}</Text> : null}
            </View>
          );
          return trackUrl ? (
            <TouchableOpacity key={i} onPress={() => Linking.openURL(trackUrl)} activeOpacity={0.7}>{content}</TouchableOpacity>
          ) : <View key={i}>{content}</View>;
        });
      }} />
    </View>
  );
}

function TopCitiesSection({ cities, scrollY }: { cities: TopCity[]; scrollY: Animated.Value }) {
  const display = cities.slice(0, 10);
  const maxListeners = Math.max(...display.map(c => c.numberOfListeners ?? 0), 1);
  const barAnims = useRef(display.map(() => new Animated.Value(0))).current;
  const containerRef = useRef<View>(null);
  const hasAnimated = useRef(false);
  const { height: screenH } = Dimensions.get('window');

  const runAnimation = () => {
    Animated.parallel(
      display.map((city, i) => {
        const target = city.numberOfListeners != null ? (city.numberOfListeners / maxListeners) * BAR_MAX_W : 0;
        return Animated.timing(barAnims[i], {
          toValue: target,
          duration: 700,
          delay: i * 50,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        });
      })
    ).start();
  };

  useEffect(() => {
    let listenerId: string;
    const check = () => {
      containerRef.current?.measureInWindow((_, y) => {
        if (y < screenH * 0.95 && !hasAnimated.current) {
          hasAnimated.current = true;
          scrollY.removeListener(listenerId);
          runAnimation();
        }
      });
    };
    listenerId = scrollY.addListener(() => check());
    // Also check immediately in case section is already visible
    setTimeout(check, 200);
    return () => scrollY.removeListener(listenerId);
  }, []);

  return (
    <View ref={containerRef}>
      <View style={sectionStyles.header}>
        <Text style={sectionStyles.sectionTitle}>Top Cities</Text>
      </View>
      {display.map((city, i) => {
        const pct = city.numberOfListeners != null ? (city.numberOfListeners / maxListeners) * 100 : 0;
        const barOpacity = 0.25 + (pct / 100) * 0.65;
        return (
          <View key={i} style={{ paddingVertical: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                <Text style={{ color: '#fff', fontSize: 12 }}>{i + 1}.</Text>
                <Text style={{ fontSize: 13, fontWeight: '500', flex: 1 }} numberOfLines={1}>
                  <Text style={{ color: '#fff' }}>{city.city}</Text>
                  {city.country ? <Text style={{ color: '#71717a' }}>{` ${city.country}`}</Text> : null}
                </Text>
              </View>
              {city.numberOfListeners != null ? <Text style={{ color: '#71717a', fontSize: 11 }}>{formatListeners(city.numberOfListeners)}</Text> : null}
            </View>
            <View style={{ height: 2, backgroundColor: '#27272a', borderRadius: 1, overflow: 'hidden' }}>
              <Animated.View style={{ height: 2, width: barAnims[i], backgroundColor: '#ffffff', borderRadius: 1, opacity: barOpacity }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function UpcomingShowsSection({ events, artistName }: { events: ArtistEvent[]; artistName: string }) {
  const now = Date.now();
  const upcoming = events
    .filter(e => { try { return new Date(e.date).getTime() >= now; } catch { return false; } })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(upcoming.length / SECTION_PER_PAGE);

  if (upcoming.length === 0) {
    return (
      <View>
        <View style={sectionStyles.header}><Text style={sectionStyles.sectionTitle}>Upcoming Shows</Text></View>
        <Text style={{ color: '#71717a', fontSize: 13 }}>No upcoming shows</Text>
      </View>
    );
  }

  return (
    <View>
      <PaginatedSectionHeader title="Upcoming Shows" page={page} totalPages={totalPages}
        onPrev={() => setPage(p => Math.max(0, p - 1))}
        onNext={() => setPage(p => Math.min(totalPages - 1, p + 1))}
      />
      <SwipeSection totalPages={totalPages} page={page} onPageChange={setPage} renderPage={pi => {
        const items = upcoming.slice(pi * SECTION_PER_PAGE, (pi + 1) * SECTION_PER_PAGE);
        return items.map((event, i) => {
          const d = (() => { try { const dd = new Date(event.date); return isNaN(dd.getTime()) ? null : dd; } catch { return null; } })();
          const month = d ? SHOW_MONTHS[d.getMonth()] : '—';
          const day = d ? String(d.getDate()).padStart(2, '0') : '—';
          const isHeadline = event.name.trim().toLowerCase() === artistName.trim().toLowerCase();
          const title = isHeadline ? event.venue : event.name;
          const subtitle = `${event.venue} · ${event.location}`;
          const href = event.url && !event.url.includes("('") && !event.url.includes('(",)') ? event.url : undefined;
          const content = (
            <View style={sectionStyles.row}>
              <View style={sectionStyles.dateBox}>
                <Text style={sectionStyles.dateMonth}>{month}</Text>
                <Text style={sectionStyles.dateDay}>{day}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={sectionStyles.rowTitle} numberOfLines={1}>{title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }}>
                  <Svg width={10} height={12} viewBox="2 1 20 22" fill="none" style={{ marginTop: 5 }}>
                    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="#71717a" strokeWidth="2" />
                    <Circle cx="12" cy="10" r="3" stroke="#71717a" strokeWidth="2" />
                  </Svg>
                  <Text style={sectionStyles.rowSub} numberOfLines={1}>{subtitle}</Text>
                </View>
              </View>
              {href && <Text style={sectionStyles.ticketsLabel}>Tickets →</Text>}
            </View>
          );
          return href ? (
            <TouchableOpacity key={i} onPress={() => Linking.openURL(href)} activeOpacity={0.7}>{content}</TouchableOpacity>
          ) : <View key={i}>{content}</View>;
        });
      }} />
    </View>
  );
}

// Pixels between each haptic tick — smaller = more frequent
const HAPTIC_STEP_PX = 2;

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function formatChartLabel(ms: number): string {
  const d = new Date(ms);
  const mon = MONTHS[d.getMonth()];
  const day = d.getDate();
  let hours = d.getHours();
  const mins = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${mon} ${day}, ${hours}:${mins} ${ampm}`;
}


function DigitRoller({ digit, fontSize }: { digit: number; fontSize: number }) {
  const digitH = fontSize * 1.2;
  const digitW = fontSize * 0.62;
  const translateY = useRef(new Animated.Value(-digit * digitH)).current;
  const prev = useRef(digit);

  useEffect(() => {
    if (prev.current === digit) return;
    prev.current = digit;
    Animated.spring(translateY, {
      toValue: -digit * digitH,
      useNativeDriver: true,
      damping: 17,
      stiffness: 160,
      mass: 1,
    }).start();
  }, [digit]);

  return (
    <View style={{ height: digitH, width: digitW, overflow: 'hidden' }}>
      <Animated.View style={{ transform: [{ translateY }] }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
          <Text
            key={d}
            style={{
              height: digitH,
              lineHeight: digitH,
              width: digitW,
              textAlign: 'center',
              fontSize,
              fontWeight: '600',
              color: '#fff',
            }}
          >
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

function AnimatedNumber({ value, style }: { value: number; style: any }) {
  const fontSize: number = style?.fontSize ?? 32;
  const digitH = fontSize * 1.2;
  const formatted = value.toFixed(2);

  const dotIdx = formatted.indexOf('.');
  const intPart = dotIdx >= 0 ? formatted.slice(0, dotIdx) : formatted;
  const fracPart = dotIdx >= 0 ? formatted.slice(dotIdx + 1) : '00';

  const chars: { key: string; char: string }[] = [];
  for (let i = 0; i < intPart.length; i++) {
    chars.push({ key: `i${intPart.length - i}`, char: intPart[i] });
  }
  chars.push({ key: 'dot', char: '.' });
  for (let i = 0; i < fracPart.length; i++) {
    chars.push({ key: `f${i + 1}`, char: fracPart[i] });
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: digitH, position: 'relative' }}>
      {chars.map(({ key, char }) => {
        const d = parseInt(char, 10);
        if (!isNaN(d)) {
          return <DigitRoller key={key} digit={d} fontSize={fontSize} />;
        }
        return (
          <Text
            key={key}
            style={{
              fontSize,
              fontWeight: '600',
              color: '#fff',
              lineHeight: digitH,
              height: digitH,
            }}
          >
            {char}
          </Text>
        );
      })}
      {/* Feather the top & bottom of the roller so digits dissolve at the crop
          edges instead of hard-cutting. Fades to the screen bg behind the number
          (rgba(...,0), not the `transparent` keyword, to avoid a dark midtone). */}
      <FadeGradient
        colors={[Colors.dark.background, 'rgba(10,10,10,0)']}
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: digitH * 0.2 }}
      />
      <FadeGradient
        colors={['rgba(10,10,10,0)', Colors.dark.background]}
        pointerEvents="none"
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: digitH * 0.2 }}
      />
    </View>
  );
}

const LABEL_WIDTH = 130;

const MARKER_R = 10;

// ── Candlestick helpers ──────────────────────────────────────────────────────
function candleRand(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

const CANDLE_SLOT_PX: Record<string, number> = { '1W': 13, '1M': 12 };
const CANDLE_WICK_SCALE: Record<string, number> = { '1D': 0.35, '1W': 0.6, '1M': 0.75, '1Y': 1.8, 'ALL': 2 };
const CANDLE_BODY_SCALE: Record<string, number> = { '1D': 0.25, '1W': 0.5, '1M': 6, '1Y': 6, 'ALL': 6 };
const CANDLE_BODY_FRAC: Record<string, number>  = { '1D': 0.8 };

interface Candle { x: number; open: number; high: number; low: number; close: number; openY: number; highY: number; lowY: number; closeY: number; }

function buildCandles(
  points: { x: number; y: number; price: number }[],
  N: number,
  toY: (p: number) => number,
  volatility: number,
  chartW: number,
  wickScale = 1,
  bodyScale = 1,
): Candle[] {
  if (points.length < 2 || N < 1) return [];
  const interp = (frac: number) => {
    const raw = frac * (points.length - 1);
    const lo = Math.floor(raw), hi = Math.min(lo + 1, points.length - 1);
    const t = raw - lo;
    return { price: points[lo].price * (1 - t) + points[hi].price * t, x: points[lo].x * (1 - t) + points[hi].x * t };
  };
  return Array.from({ length: N }, (_, i) => {
    const base = interp(i / N), mid = interp((i + 0.5) / N), end = interp((i + 1) / N);
    const open  = base.price + (candleRand(i * 4)     - 0.5) * 2 * volatility * bodyScale;
    const close = end.price  + (candleRand(i * 4 + 1) - 0.5) * 2 * volatility * bodyScale;
    const rawHigh = Math.max(open, close, mid.price);
    const rawLow  = Math.min(open, close, mid.price);
    const spread  = Math.max(rawHigh - rawLow, volatility * 0.4);
    const high = rawHigh + (0.3 + candleRand(i * 4 + 2) * 0.7) * spread * wickScale;
    const low  = rawLow  - (0.3 + candleRand(i * 4 + 3) * 0.7) * spread * wickScale;
    const x = (i + 0.5) / N * chartW;
    return { x, open, high, low, close, openY: toY(open), highY: toY(high), lowY: toY(low), closeY: toY(close) };
  });
}
// ────────────────────────────────────────────────────────────────────────────

function BigChart({ data, timestamps, startTime, color, onValueChange, releases, chartMode = 'line', activePeriod = '1D' }: {
  data: number[],
  timestamps: number[], // ms since epoch
  startTime: number,    // ms — left edge of the x axis
  color: string,
  onValueChange?: (value: number | null) => void,
  releases?: Release[],
  chartMode?: 'line' | 'candle',
  activePeriod?: string,
}) {
  const width = CHART_WIDTH;
  const height = 240;
  const CIRCLE_SPACE = 30;           // extra px below bottom grid line for circles
  const totalHeight = height + CIRCLE_SPACE;
  const GRID_OFFSET = 10;            // px the grid SVG extends above the outer view (lines bleed above top grid line)

  // Draw-on animation
  const drawAnim     = useRef(new Animated.Value(0)).current;
  const pulseScale   = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.8)).current;
  const [drawDone, setDrawDone] = useState(false);
  // Include startTime so every timeframe switch produces a unique key,
  // preventing stale drawDone state when returning to a previously-seen tab.
  const dataKey = data.length > 0 ? `${startTime}-${data.length}-${data[0]}-${data[data.length - 1]}` : '';
  useEffect(() => {
    if (data.length < 2) return;
    setDrawDone(false);
    drawAnim.setValue(0);
    Animated.timing(drawAnim, {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => { if (finished) setDrawDone(true); });
  }, [dataKey]);

  // Candle fade-in animation — triggers on period/data change
  const candleAnim = useRef(new Animated.Value(0)).current;
  const candleTranslate = useRef(new Animated.Value(6)).current;
  const candleKey = `${activePeriod}-${dataKey}`;
  useEffect(() => {
    if (chartMode !== 'candle') return;
    candleAnim.setValue(0);
    candleTranslate.setValue(6);
    Animated.parallel([
      Animated.timing(candleAnim, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(candleTranslate, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [candleKey, chartMode]);

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale, { toValue: 3.2, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseScale, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.8, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  // All pixel-level tracking via Animated.Values — zero state, zero re-renders
  const cursorX = useRef(new Animated.Value(0)).current;
  const dotY    = useRef(new Animated.Value(0)).current;
  const labelX  = useRef(new Animated.Value(0)).current;
  // dimOverlayX drives the right-side dim: a wide black View translated to cursorX
  const dimOverlayX = useRef(new Animated.Value(width)).current;

  // Refs so PanResponder closures always see fresh data
  const timestampsRef      = useRef(timestamps);
  timestampsRef.current    = timestamps;
  const dataRef            = useRef(data);
  dataRef.current          = data;
  const onValueChangeRef   = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;
  const pointsRef          = useRef<{ x: number; y: number }[]>([]);
  const chartModeRef       = useRef(chartMode);
  chartModeRef.current     = chartMode;
  const candlesRef         = useRef<Candle[]>([]);

  const lastHapticX    = useRef(-999);
  const lastLabelIndex = useRef(-1);
  const lastCandleIdx  = useRef(-1);

  // Release marker interaction — pre-allocated so hook count is stable
  const releaseMarkersRef    = useRef<{ x: number; image: string; name: string }[]>([]);
  const markerScaleAnims     = useRef([...Array(40)].map(() => new Animated.Value(1))).current;
  const lastActiveMarkerRef  = useRef<number | null>(null);

  // State only for: show/hide overlays + label text (both infrequent)
  const [isTouching, setIsTouching]       = useState(false);
  const [labelText, setLabelText]         = useState('');
  const [activeMarkerIdx, setActiveMarkerIdx] = useState<number | null>(null);
  const [activeCandleIdx, setActiveCandleIdx] = useState<number | null>(null);
  const [showMarkerLabel, setShowMarkerLabel] = useState(false);
  const showMarkerLabelRef = useRef(false);

  const updateFromX = (x: number) => {
    const pts = pointsRef.current;
    const d   = dataRef.current;
    const ts  = timestampsRef.current;
    if (pts.length < 2) return;

    cursorX.setValue(x);
    dimOverlayX.setValue(x);
    labelX.setValue(Math.max(0, Math.min(CHART_WIDTH - LABEL_WIDTH, x - LABEL_WIDTH / 2)));

    if (chartModeRef.current === 'candle') {
      // Find nearest candle
      const cs = candlesRef.current;
      if (cs.length > 0) {
        let nearest = 0;
        let nearestDist = Math.abs(cs[0].x - x);
        for (let i = 1; i < cs.length; i++) {
          const dist = Math.abs(cs[i].x - x);
          if (dist < nearestDist) { nearestDist = dist; nearest = i; }
        }
        if (nearest !== lastCandleIdx.current) {
          lastCandleIdx.current = nearest;
          setActiveCandleIdx(nearest);
          const c = cs[nearest];
          onValueChangeRef.current?.(c.close);
          setLabelText(formatChartLabel(c.x / (width / (ts[ts.length - 1] - ts[0])) + ts[0]));
        }
      }
      return;
    }

    // Binary search: find last point whose x <= touch x (points are time-ordered)
    let lo = 0, hi = pts.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (pts[mid].x <= x) lo = mid; else hi = mid - 1;
    }
    const floorIdx = lo;
    const ceilIdx  = Math.min(floorIdx + 1, pts.length - 1);

    const dx = pts[ceilIdx].x - pts[floorIdx].x;
    const t  = dx > 0 ? (x - pts[floorIdx].x) / dx : 0;

    // Linearly interpolate Y so the dot follows the visual line exactly
    const interpY = pts[floorIdx].y + t * (pts[ceilIdx].y - pts[floorIdx].y);
    dotY.setValue(interpY - 4);   // -4 centers the 8px dot on the line

    // Text / value callbacks only when crossing into a new data bucket
    const bucketIdx = t < 0.5 ? floorIdx : ceilIdx;
    if (bucketIdx !== lastLabelIndex.current) {
      lastLabelIndex.current = bucketIdx;
      setLabelText(formatChartLabel(ts[bucketIdx]));
      onValueChangeRef.current?.(d[bucketIdx]);
    }

    // Release marker proximity — always activate the nearest marker (no dead zones)
    const markers = releaseMarkersRef.current;
    let newActive: number | null = null;
    if (markers.length > 0) {
      let nearestIdx = 0;
      let nearestDist = Math.abs(markers[0].x - x);
      for (let i = 1; i < markers.length; i++) {
        const dist = Math.abs(markers[i].x - x);
        if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }
      }
      newActive = nearestIdx;
    }
    if (newActive !== lastActiveMarkerRef.current) {
      lastActiveMarkerRef.current = newActive;
      setActiveMarkerIdx(newActive);
      markers.forEach((_, i) => {
        if (i < markerScaleAnims.length) {
          Animated.spring(markerScaleAnims[i], {
            toValue: i === newActive ? 1.55 : 1,
            useNativeDriver: true,
            damping: 15, stiffness: 180, mass: 1,
          }).start();
        }
      });
    }

    // Show album name only while cursor is approaching the bubble (before reaching it)
    const activeIdx = newActive ?? lastActiveMarkerRef.current;
    const shouldShowLabel = activeIdx !== null && markers[activeIdx] != null && x <= markers[activeIdx].x + MARKER_R;
    if (shouldShowLabel !== showMarkerLabelRef.current) {
      showMarkerLabelRef.current = shouldShowLabel;
      setShowMarkerLabel(shouldShowLabel);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (evt) => {
        const x = Math.max(0, Math.min(CHART_WIDTH, evt.nativeEvent.locationX));
        lastHapticX.current    = x;
        lastLabelIndex.current = -1;
        setIsTouching(true);
        updateFromX(x);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (evt) => {
        const x = Math.max(0, Math.min(CHART_WIDTH, evt.nativeEvent.locationX));
        updateFromX(x);
        if (Math.abs(x - lastHapticX.current) >= HAPTIC_STEP_PX) {
          lastHapticX.current = x;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      },
      onPanResponderRelease: () => {
        setIsTouching(false);
        setDrawDone(true);
        dimOverlayX.setValue(width);
        onValueChangeRef.current?.(null);
        lastHapticX.current    = -999;
        lastLabelIndex.current = -1;
        lastCandleIdx.current  = -1;
        setActiveCandleIdx(null);
        if (lastActiveMarkerRef.current !== null) {
          lastActiveMarkerRef.current = null;
          setActiveMarkerIdx(null);
          releaseMarkersRef.current.forEach((_, i) => {
            if (i < markerScaleAnims.length) {
              Animated.spring(markerScaleAnims[i], { toValue: 1, useNativeDriver: true, damping: 15, stiffness: 180, mass: 1 }).start();
            }
          });
        }
      },
      onPanResponderTerminate: () => {
        setIsTouching(false);
        setDrawDone(true);
        dimOverlayX.setValue(width);
        onValueChangeRef.current?.(null);
        lastHapticX.current    = -999;
        lastLabelIndex.current = -1;
        lastCandleIdx.current  = -1;
        setActiveCandleIdx(null);
        if (lastActiveMarkerRef.current !== null) {
          lastActiveMarkerRef.current = null;
          setActiveMarkerIdx(null);
          releaseMarkersRef.current.forEach((_, i) => {
            if (i < markerScaleAnims.length) {
              Animated.spring(markerScaleAnims[i], { toValue: 1, useNativeDriver: true, damping: 15, stiffness: 180, mass: 1 }).start();
            }
          });
        }
      },
    })
  ).current;

  // Time-proportional x: last timestamp is always "now", maps to right edge
  // Computed before early return so useMemo hook is always called
  const endTime = timestamps.length > 0 ? (timestamps[timestamps.length - 1] ?? startTime + 1) : startTime + 1;
  const timeRange = endTime - startTime || 1;

  const MARKER_Y = height + CIRCLE_SPACE / 2;  // center in the extra space below the bottom dashed line
  const releaseMarkers = useMemo(() => {
    if (!releases?.length || timestamps.length < 2) return [];
    const byDate = new Map<string, Release>();
    for (const r of releases) {
      if (!r.date || !r.image) continue;
      const existing = byDate.get(r.date);
      if (!existing || (r.type === 'ALBUM' && existing.type !== 'ALBUM')) {
        byDate.set(r.date, r);
      }
    }
    return Array.from(byDate.values()).flatMap((r) => {
      const ms = new Date(r.date!).getTime();
      if (isNaN(ms) || ms < startTime || ms > endTime) return [];
      const x = ((ms - startTime) / timeRange) * width;
      return [{ x, image: r.image!, name: r.name }];
    });
  }, [releases, startTime, endTime, timeRange, width]);
  releaseMarkersRef.current = releaseMarkers;

  const min  = data.length >= 2 ? Math.min(...data) : 0;
  const max  = data.length >= 2 ? Math.max(...data) : 1;
  const range = max === min ? 1 : max - min;
  const verticalPadding = 40;
  const h = height - verticalPadding * 2;

  const toY = (price: number) => height - verticalPadding - ((price - min) / range) * h;

  const volatility = useMemo(() => {
    if (data.length < 2) return 0;
    let sum = 0;
    for (let i = 1; i < data.length; i++) sum += Math.abs(data[i] - data[i - 1]);
    return sum / (data.length - 1);
  }, [data]);

  const points = data.length >= 2 ? data.map((val, i) => ({
    x: ((timestamps[i] - startTime) / timeRange) * width,
    y: height - verticalPadding - ((val - min) / range) * h,
    price: val,
  })) : [];
  pointsRef.current = points;

  const candles = useMemo(() => {
    if (chartMode !== 'candle' || data.length < 2) return [];
    const pts = data.map((val, i) => ({
      x: ((timestamps[i] - startTime) / timeRange) * width,
      y: height - verticalPadding - ((val - min) / range) * h,
      price: val,
    }));
    const N = Math.floor(width / (CANDLE_SLOT_PX[activePeriod] ?? 9));
    return buildCandles(pts, N, toY, volatility, width, CANDLE_WICK_SCALE[activePeriod] ?? 1, CANDLE_BODY_SCALE[activePeriod] ?? 1);
  }, [chartMode, data, timestamps, startTime, timeRange, volatility, activePeriod, width, min, range, h]);

  candlesRef.current = candles;

  if (data.length < 2) return <View style={{ width, height: totalHeight }} />;

  const fullPath = points.reduce(
    (acc, p, i) => (i === 0 ? `M${p.x},${p.y}` : `${acc} L${p.x},${p.y}`),
    ''
  );

  // Approximate total path length for the draw animation
  const totalLength = points.reduce((sum, p, i) => {
    if (i === 0) return 0;
    const prev = points[i - 1];
    return sum + Math.hypot(p.x - prev.x, p.y - prev.y);
  }, 0);

  const strokeDashoffset = drawAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [totalLength, 0],
  });

  const last = points[points.length - 1];
  const DOT = 3.5;

  return (
    // Outer view: full screen width, overflow visible so the grid SVG can bleed above
    <View style={{ width: SCREEN_WIDTH, height: totalHeight, position: 'relative', overflow: 'visible' }} {...panResponder.panHandlers}>

      {/* Grid SVG shifted up by GRID_OFFSET so marker lines can bleed above the top dashed line */}
      <Svg width={SCREEN_WIDTH} height={totalHeight + GRID_OFFSET} style={{ position: 'absolute', top: -GRID_OFFSET, left: 0 }} pointerEvents="none">
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = frac * height + GRID_OFFSET;
          return (
            <Path
              key={frac}
              d={`M0,${y} L${SCREEN_WIDTH},${y}`}
              stroke="rgba(255,255,255,0.20)"
              strokeWidth="0.5"
              strokeDasharray="1 4"
            />
          );
        })}
        {releaseMarkers.map((m, i) => (
          <SvgLine
            key={`vl-${i}`}
            x1={m.x || 0} y1={0}
            x2={m.x || 0} y2={MARKER_Y - MARKER_R - 3 + GRID_OFFSET}
            stroke={activeMarkerIdx === i ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}
            strokeWidth="1"
          />
        ))}
      </Svg>

      {/* Album art circles — React Native Views so transform-origin scale works */}
      {releaseMarkers.map((m, i) => (
        <Animated.View
          key={`marker-${i}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: m.x - MARKER_R,
            top: MARKER_Y - MARKER_R,
            width: MARKER_R * 2,
            height: MARKER_R * 2,
            transform: [{ scale: markerScaleAnims[i] }],
            zIndex: activeMarkerIdx === i ? 10 : 1,
          }}
        >
          <View style={{ position: 'absolute', width: MARKER_R * 2, height: MARKER_R * 2, borderRadius: MARKER_R, overflow: 'hidden', backgroundColor: '#27272a' }}>
            {m.image ? (
              <Image source={{ uri: m.image }} style={{ width: MARKER_R * 2, height: MARKER_R * 2 }} resizeMode="cover" />
            ) : null}
          </View>
          <View style={{ position: 'absolute', width: MARKER_R * 2, height: MARKER_R * 2, borderRadius: MARKER_R, borderWidth: 0.75, borderColor: 'rgba(255,255,255,0.2)' }} />
        </Animated.View>
      ))}

      {/* Inner view: clipped to chart width to contain the dim overlay */}
      <View style={{ width, height, overflow: 'hidden', position: 'absolute' }}>

        {/* Chart line / candlesticks */}
        <Svg width={width} height={height} style={{ position: 'absolute' }}>
          {/* Faint line watermark behind candles */}
          {chartMode === 'candle' && (
            <Path d={fullPath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.12} />
          )}
          {/* Line chart */}
          {chartMode === 'line' && (
            <AnimatedPath
              d={fullPath}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={totalLength}
              strokeDashoffset={strokeDashoffset}
            />
          )}
        </Svg>

        {/* Candlestick chart — separate animated layer so it fades in independently */}
        {chartMode === 'candle' && (
          <Animated.View
            pointerEvents="none"
            style={{ position: 'absolute', width, height, opacity: candleAnim, transform: [{ translateY: candleTranslate }] }}
          >
            <Svg width={width} height={height}>
              {candles.map((c, i) => {
                const bullish = c.close >= c.open;
                const candleColor = bullish ? COLOR_GREEN : COLOR_RED;
                const bodyTop = Math.min(c.openY, c.closeY);
                const bodyH = Math.max(Math.abs(c.closeY - c.openY), 1.5);
                const candleW = Math.max((width / candles.length) * (CANDLE_BODY_FRAC[activePeriod] ?? 0.8), 2);
                const MAX_WICK = 28;
                const wickTop = Math.max(c.highY, bodyTop - MAX_WICK);
                const wickBottom = Math.min(c.lowY, bodyTop + bodyH + MAX_WICK);
                const dimmed = activeCandleIdx !== null && i > activeCandleIdx;
                return (
                  <React.Fragment key={i}>
                    <SvgLine x1={c.x} y1={wickTop} x2={c.x} y2={wickBottom} stroke={candleColor} strokeWidth="1" opacity={dimmed ? 0.15 : 0.8} />
                    <Rect x={c.x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={candleColor} opacity={dimmed ? 0.15 : 0.9} rx={0.5} />
                  </React.Fragment>
                );
              })}
            </Svg>
          </Animated.View>
        )}

      {/* Right-side dim: a wide black overlay translated to cursorX.
          Driven by Animated.Value → native thread, no re-renders. */}
      {isTouching && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: width * 2,
            backgroundColor: Colors.dark.background,
            opacity: 0.6,
            transform: [{ translateX: dimOverlayX }],
          }}
        />
      )}

      {/* Cursor line — kept here as placeholder; actual line rendered in outer view */}

      {/* Dot — linearly interpolated Y, centered on the visual line (hidden in candle mode) */}
      {isTouching && chartMode === 'line' && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: -4,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: color,
            transform: [{ translateX: cursorX }, { translateY: dotY }],
          }}
        />
      )}

      </View>{/* end inner clipped view */}

      {/* Outer dim overlay — extends the chart dim down through the album-line area */}
      {isTouching && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -GRID_OFFSET,
            height: MARKER_Y - MARKER_R - 3 + GRID_OFFSET,
            left: 0,
            width: width * 2,
            backgroundColor: Colors.dark.background,
            opacity: 0.6,
            zIndex: 1,
            transform: [{ translateX: dimOverlayX }],
          }}
        />
      )}

      {/* Cursor line — rendered after the dim overlay so it's never covered */}
      {isTouching && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -GRID_OFFSET,
            height: MARKER_Y - MARKER_R - 3 + GRID_OFFSET,
            width: 1,
            backgroundColor: 'rgba(255,255,255,0.45)',
            zIndex: 4,
            transform: [{ translateX: cursorX }],
          }}
        />
      )}

      {/* Date / album-name label — above all overlays */}
      {isTouching && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 4,
            width: LABEL_WIDTH,
            alignItems: 'center',
            gap: 2,
            zIndex: 5,
            transform: [{ translateX: labelX }],
          }}
        >
          {showMarkerLabel && activeMarkerIdx !== null && releaseMarkersRef.current[activeMarkerIdx] && (
            <Text numberOfLines={1} style={{ color: '#e4e4e7', fontSize: 10, fontWeight: '600', letterSpacing: 0.1 }}>
              {(() => { const n = releaseMarkersRef.current[activeMarkerIdx]?.name ?? ''; return n.length > 18 ? n.slice(0, 17) + '…' : n; })()}
            </Text>
          )}
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', letterSpacing: 0.3 }}>
            {labelText}
          </Text>
        </Animated.View>
      )}

      {/* Pulsating dot — always mounted so native driver stays attached */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: last.x - DOT,
          top: last.y - DOT,
          width: DOT * 2,
          height: DOT * 2,
          opacity: (drawDone && !isTouching && chartMode === 'line') ? 1 : 0,
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            width: DOT * 2,
            height: DOT * 2,
            borderRadius: DOT,
            backgroundColor: color,
            opacity: pulseOpacity,
            transform: [{ scale: pulseScale }],
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: DOT * 2,
            height: DOT * 2,
            borderRadius: DOT,
            backgroundColor: color,
          }}
        />
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  disclaimerCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  disclaimerTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  disclaimerText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    lineHeight: 17,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: COLOR_RED,
    fontSize: 14,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 20,
    padding: 10,
  },
  backButtonText: {
    color: '#fff',
  },
  navBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    backgroundColor: Colors.dark.background,
  },
  scrollContent: {},
  backButtonNav: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  copyButtonNav: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  moreButtonNav: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameHeader: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  artistAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  artistAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#27272a',
  },
  largeName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '400',
    letterSpacing: -0.6,
  },
  topStatsGrid: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1c1c1e',
    backgroundColor: Colors.dark.background,
  },
  topStatsContent: {
    paddingHorizontal: 0,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topStatItem: {
    paddingHorizontal: 12,
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: '#27272a',
  },
  topStatLabel: {
    color: '#71717a',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  topStatValue: {
    color: '#D4D4D8',
    fontSize: 13,
    fontWeight: '500',
  },
  headlineContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headlinePrice: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: -0.8,
  },
  headlineLabel: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '400',
    letterSpacing: -0.6,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  changeValueText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chartArea: {
    marginTop: 20,
    width: '100%',
    backgroundColor: Colors.dark.background,
  },
  timeControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  timeSelectGroup: {
    flexDirection: 'row',
    gap: 16,
  },
  periodBtn: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  periodBtnText: {
    color: '#52525b',
    fontSize: 14,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerActionBtn: {
    padding: 6,
    borderRadius: 6,
  },
  headerActionBtnActive: {
    backgroundColor: '#fff',
  },
  hDivider: {
    height: 1,
    backgroundColor: '#1c1c1e',
    marginHorizontal: 16,
  },
  actionContainer: {
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 99, // fully rounded
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  metricsPanel: {
    marginTop: 8,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 0,
  },
  metricsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 0,
  },
  metricsTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  metricLabel: {
    color: '#71717a',
    fontSize: 13,
  },
  metricValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownsContainer: {
    marginTop: 8,
    marginHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#1c1c1e',
  },
  tradeGroups: {
    marginTop: 0,
  },
  tradeSection: {
    paddingTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
    paddingBottom: 8,
  },
  tradeSectionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  emptyText: {
    color: '#52525b',
    fontSize: 12,
    paddingBottom: 24,
  },
  tradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  tradeRowSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 80,
  },
  sideIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tradeRowText: {
    color: '#fff',
    fontSize: 14,
  },
  tradeRowValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tradeRowSub: {
    color: '#71717a',
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    minHeight: 300,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#3f3f46',
    borderRadius: 2,
    marginBottom: 32,
  },
  sheetTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sheetContent: {
    paddingTop: 24,
  },
  detailGroup: {
    backgroundColor: Colors.dark.background,
    marginBottom: 24,
    marginHorizontal: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: {
    color: '#71717a',
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeTradeBtn: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 99,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  closeTradeBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },

  accordionContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 0,
  },
  accordionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: -0.4,
  },
  accordionContent: {
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  infoText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    lineHeight: 20,
    paddingBottom: 20,
  },
  noDataText: {
    color: '#71717a',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  modalKeyboardAvoiding: {
     width: '100%',
  },
  modalContent: {
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    minHeight: 480,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#27272a',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 32,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 48,
  },
  sideToggleGroup: {
    flexDirection: 'row',
    gap: 20,
  },
  sideToggleText: {
    fontSize: 22,
    fontWeight: '500',
  },
  typeSelectorWrapper: {
    position: 'relative',
    zIndex: 100,
  },
  typeSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeSelectorText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  typeDropdown: {
    position: 'absolute',
    top: 32,
    right: 0,
    backgroundColor: '#18181b',
    borderRadius: 8,
    padding: 4,
    minWidth: 100,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  typeOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  typeOptionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  mainInputSection: {
    marginBottom: 24,
  },
  bareInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  bareInput: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '400',
    lineHeight: 48,
    minWidth: 40,
    padding: 0,
    margin: 0,
  },
  bareInputSuffix: {
    color: '#9d9b9b',
    fontSize: 40,
    fontWeight: '400',
    lineHeight: 40,
    marginLeft: 12,
  },
  tradeInfoSection: {
    gap: 4,
    marginBottom: 48,
  },
  infoLine: {
    color: '#9d9b9b',
    fontSize: 13,
  },
  desktopActionBtn: {
    backgroundColor: '#fff',
    borderRadius: 99,
    paddingVertical: 14,
    alignItems: 'center',
  },
  desktopActionBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },
});

const shareStyles = StyleSheet.create({
  sheet: {
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
    marginBottom: 16,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#3f3f46',
    borderRadius: 2,
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  card: {
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 12,
    backgroundColor: Colors.dark.background,
    padding: 20,
  },
  traderLabel: {
    color: '#71717a',
    fontSize: 11,
  },
  traderName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    marginTop: 2,
  },
  contractsPill: {
    backgroundColor: '#27272a',
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  contractsText: {
    color: '#fff',
    fontSize: 11,
  },
  positionBox: {
    flexDirection: 'column',
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#18181b',
    borderRadius: 8,
    padding: 16,
    marginTop: 20,
  },
  posLabel: {
    color: '#71717a',
    fontSize: 11,
  },
  posArtist: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    marginTop: 4,
  },
  pnlLabel: {
    color: '#71717a',
    fontSize: 11,
  },
  pnlValue: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#27272a',
    marginTop: 16,
    marginBottom: 12,
  },
  statLabel: {
    color: '#71717a',
    fontSize: 11,
  },
  statVal: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  brandName: {
    color: '#52525b',
    fontSize: 16,
    fontWeight: '400',
  },
  brandUrl: {
    color: '#52525b',
    fontSize: 10,
  },
  shareBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3f3f46',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const sectionStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: -0.4,
  },
  arrowBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#3f3f46',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageLabel: {
    color: '#71717a',
    fontSize: 12,
    minWidth: 32,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 4,
    backgroundColor: '#27272a',
    overflow: 'hidden',
    flexShrink: 0,
  },
  thumbPlaceholder: {
    flex: 1,
    backgroundColor: '#27272a',
  },
  rowTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  rowSub: {
    color: '#71717a',
    fontSize: 12,
    marginTop: 5,
  },
  rowRight: {
    color: '#71717a',
    fontSize: 11,
    flexShrink: 0,
    textAlign: 'right',
  },
  dateBox: {
    width: 44,
    height: 44,
    borderRadius: 4,
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dateMonth: {
    color: '#71717a',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateDay: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  ticketsLabel: {
    color: '#71717a',
    fontSize: 12,
    flexShrink: 0,
  },
  bioText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    lineHeight: 20,
  },
  showMore: {
    color: '#71717a',
    fontSize: 12,
  },
  socialLink: {
    color: '#a1a1aa',
    fontSize: 12,
  },
  statValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statLabel: {
    color: '#71717a',
    fontSize: 11,
    marginTop: 2,
  },
});

