import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing as RNEasing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Reanimated, { Easing, FadeIn, Keyframe, makeMutable, runOnJS, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { ENDPOINTS } from '@/constants/API';
import { Colors } from '@/constants/theme';
import { POSITIVE, NEGATIVE } from '@/constants/colors';

const { height: SCREEN_H } = Dimensions.get('window');
const BAR_BASE_H = 116;        // resting height of the confirm bar
const SWIPE_THRESHOLD = 130;   // px of upward drag to confirm
const SWIPE_LIFT = SCREEN_H * 0.2; // max upward travel of the panel + bar on a full swipe (~20% of the screen)
// Local order stub. OFF unless explicitly switched on in a dev build: a trading
// screen that fakes success is the one bug that costs a user money silently, so
// it must not be possible to ship it by forgetting to flip a constant back.
const DUMMY_ORDERS =
  __DEV__ && process.env.EXPO_PUBLIC_DUMMY_ORDERS === '1';

// ── swipe feel ──
const ARM_AT = 0.8;        // progress at which the order arms ("Release to place")
const ARM_HYST = 0.08;     // must drop this far back below ARM_AT to disarm (no chatter at the edge)
const OVERDRAG = 0.25;     // max rubber-band stretch past 100% (progress units, asymptotic)
const OVERDRAG_SOFT = 0.8; // how quickly the overdrag resistance builds (smaller = stiffer)
const CLOSE_DRAG = 140;        // px of downward drag (or a flick) to dismiss the sheet

export interface TradePanelProps {
  isVisible: boolean;
  onClose: () => void;
  artistName: string;
  imageUrl?: string | null;
  spotifyId: string;
  price: number;
  color: string;
}

type OpenPosition = { position_type: 'long' | 'short'; contracts: number; total_cost: number };

// ─── icons ──────────────────────────────────────────────────────────────────
const CloseIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6l12 12M6 18L18 6" stroke="#a1a1aa" strokeWidth={2} strokeLinecap="round" />
  </Svg>
);
const ChevronUp = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M6 15l6-6 6 6" stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── animated amount: per-glyph rise/drop + curved comma re-position (chart-header font) ──
// New digit rises from below; removed digit drops down; persisting glyphs slide to re-center.
// A comma drops in from above and arcs (dips underneath) when it moves between groups.

const AMOUNT_BOX_H = 112;
const TOGGLE_SEG_W = 96; // Up/Down segment width (fixed so the highlight slides cleanly)
const TOGGLE_SEG_H = 38;
const TOGGLE_IDLE = '#71717a'; // idle (unselected) toggle text color
const FEATHER = 26; // height of the soft (gradient) fade at the top & bottom edges
// Feathers must fade to the panel bg with ZERO alpha — NOT the keyword 'transparent',
// which is transparent *black* (rgba(0,0,0,0)) and darkens a non-black bg into visible bands.
const FEATHER_BG_T = 'rgba(10, 10, 10, 0)'; // Colors.dark.background (rgb(10,10,10)) at alpha 0
// Quartic OUT (fast→slow) almost everywhere across the amount. The one exception is the comma
// re-position, which uses quartic IN-OUT.
const EASE_OUT = Easing.out(Easing.poly(4));
const EASE_INOUT = Easing.inOut(Easing.poly(4)); // comma re-position
const AMT_DUR = 240; // shared by digits / $ / dot / flip / dim
const COMMA_DUR = 120; // the comma re-position runs faster than the rest
const RISE = 85; // vertical travel for digit rise-in / drop-out / flip (clears the fade fully)
const COMMA_DIP = 26; // how far a comma dips below while it re-positions

// Digits rise up from below (in) and drop down (out).
const RiseIn = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: RISE }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_OUT },
});
// Shared exit for amount glyphs, with the direction decided AT EXIT TIME on the UI thread:
// a +$ chip sets flipExitUp before committing (its replaced digits rise out the TOP, mirroring
// the new ones rising in from below); every keypad press clears it (deleted digits drop out the
// BOTTOM). Deciding at exit time — instead of an `exiting` keyframe captured a render too early
// — is what lets the same glyph exit differently for flips vs deletes, with no nested ghost
// views for Reanimated's exit-resurrection to replay (the phantom-glyph-on-erase bug).
const flipExitUp = makeMutable(0);
function glyphExit(values: any) {
  'worklet';
  return {
    initialValues: {
      originX: values.currentOriginX,
      originY: values.currentOriginY,
    },
    animations: {
      originY: withTiming(values.currentOriginY + (flipExitUp.value ? -RISE : RISE), { duration: AMT_DUR, easing: EASE_OUT }),
    },
  };
}
// Upward exit: used by the empty-state '0' when the first digit is typed.
const RiseOut = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }] },
  100: { opacity: 1, transform: [{ translateY: -RISE }], easing: EASE_OUT },
});
// Straight horizontal re-flow for any glyph (digits / $ / dot): slide to the new slot in
// AMT_DUR with quartic OUT, in both directions.
function slideLayout(values: any) {
  'worklet';
  const easing = EASE_OUT;
  return {
    initialValues: {
      originX: values.currentOriginX,
      originY: values.currentOriginY,
      width: values.currentWidth,
      height: values.currentHeight,
    },
    animations: {
      originX: withTiming(values.targetOriginX, { duration: AMT_DUR, easing }),
      originY: withTiming(values.targetOriginY, { duration: AMT_DUR, easing }),
      width: withTiming(values.targetWidth, { duration: AMT_DUR, easing }),
      height: withTiming(values.targetHeight, { duration: AMT_DUR, easing }),
    },
  };
}

// Comma re-position (only when the digit COUNT changed): the whole thing is quartic IN-OUT —
// horizontal X slide plus a Y arc (dip DOWN then back UP), the two Y legs splitting COMMA_DUR so
// the arc lands exactly when the X slide does.
function commaArc(values: any) {
  'worklet';
  const easing = EASE_INOUT; // whole comma re-position
  const half = COMMA_DUR / 2;
  return {
    initialValues: {
      originX: values.currentOriginX,
      originY: values.currentOriginY,
      width: values.currentWidth,
      height: values.currentHeight,
    },
    animations: {
      originX: withTiming(values.targetOriginX, { duration: COMMA_DUR, easing }),
      originY: withSequence(
        withTiming(values.currentOriginY + COMMA_DIP, { duration: half, easing }),
        withTiming(values.targetOriginY, { duration: half, easing }),
      ),
      width: withTiming(values.targetWidth, { duration: COMMA_DUR, easing }),
      height: withTiming(values.targetHeight, { duration: COMMA_DUR, easing }),
    },
  };
}

// Stable identities so each element animates as itself: '$' fixed; the empty-state '0' is a
// distinct 'placeholder' (so the first typed digit rises while it drops out); integer digits
// are left-index keyed (d0 = leftmost → a newly typed digit gets a fresh right-most slot and
// rises while the rest slide); commas are keyed by group-from-the-right (so a comma keeps its
// identity and arcs to its new spot instead of a digit morphing into it).
function buildGlyphs(amount: string): { key: string; char: string; comma: boolean; fade: boolean }[] {
  const out: { key: string; char: string; comma: boolean; fade: boolean }[] = [{ key: 'dollar', char: '$', comma: false, fade: false }];
  if (amount === '') {
    // enters with a fade; exits UPWARD (RiseOut) when the first digit is typed, so it reads like
    // a +$ flip — the '0' rises out the top while the typed digit rises in from below
    out.push({ key: 'placeholder', char: '0', comma: false, fade: true });
    return out;
  }
  const hasDot = amount.includes('.');
  const [intRaw, decRaw = ''] = amount.split('.');
  const intDigits = intRaw === '' ? '0' : String(parseInt(intRaw, 10) || 0);
  const n = intDigits.length;
  for (let i = 0; i < n; i++) {
    if (i > 0 && (n - i) % 3 === 0) out.push({ key: `comma${(n - i) / 3}`, char: ',', comma: true, fade: false });
    out.push({ key: `d${i}`, char: intDigits[i], comma: false, fade: false });
  }
  if (hasDot) {
    out.push({ key: 'dot', char: '.', comma: false, fade: false });
    for (let i = 0; i < decRaw.length; i++) out.push({ key: `dec${i}`, char: decRaw[i], comma: false, fade: false });
  }
  return out;
}

// Integer digits of an amount with leading zeros stripped (matches buildGlyphs' d-indexing).
function intDigitsOf(amount: string): string {
  if (amount === '') return '0';
  const intRaw = amount.split('.')[0];
  return intRaw === '' ? '0' : String(parseInt(intRaw, 10) || 0);
}

function AnimatedAmount({ amount, dim, flipGen }: { amount: string; dim: boolean; flipGen: number }) {
  const fontSize = 72; // fixed — digits never shrink as the number grows

  // On a +$ chip (flipGen bumps), flip from the most-significant CHANGED integer digit
  // rightward to the units; leave unchanged leading digits alone. The nonces are baked into
  // the digit KEYS below, so bumping one re-keys that digit in this same render — the old
  // glyph exits and the new one enters as ordinary keyed mount/unmount.
  const prevAmountRef = useRef(amount);
  const prevFlipRef = useRef(flipGen);
  const noncesRef = useRef<Record<string, number>>({});
  if (flipGen !== prevFlipRef.current) {
    const oldInt = intDigitsOf(prevAmountRef.current);
    const newInt = intDigitsOf(amount);
    let firstChanged = -1;
    for (let i = 0; i < newInt.length; i++) {
      if (newInt[i] !== oldInt[i]) { firstChanged = i; break; }
    }
    if (firstChanged >= 0) {
      for (let i = firstChanged; i < newInt.length; i++) {
        noncesRef.current[`d${i}`] = (noncesRef.current[`d${i}`] || 0) + 1;
      }
    }
    prevFlipRef.current = flipGen;
  }
  // A comma only arcs when the integer digit COUNT changed (a real group change). On a pure
  // value change (count same) it would just be a tiny reflow nudge → straight, no dip.
  const countChanged = intDigitsOf(prevAmountRef.current).length !== intDigitsOf(amount).length;
  prevAmountRef.current = amount;

  // animate the dim (50%) → full (100%) opacity with the shared quartic easing
  const dimOpacity = useSharedValue(dim ? 0.5 : 1);
  useEffect(() => {
    dimOpacity.value = withTiming(dim ? 0.5 : 1, { duration: AMT_DUR, easing: EASE_OUT });
  }, [dim, dimOpacity]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dimOpacity.value }));

  const glyphs = buildGlyphs(amount);
  return (
    <View style={{ width: '100%', height: AMOUNT_BOX_H, overflow: 'hidden' }}>
      <Reanimated.View style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, dimStyle]}>
        {glyphs.map(({ key, char, comma, fade }) => (
          <Reanimated.View
            // Digits carry their flip nonce in the KEY: a +$ chip re-keys the changed digits,
            // so the old glyph unmounts (exits UP via glyphExit) while the new one mounts
            // (RiseIn from below) — the whole flip is plain keyed enter/exit on the UI thread,
            // with nothing nested for the exit-resurrection to replay.
            key={fade ? key : `${key}#${noncesRef.current[key] || 0}`}
            entering={fade ? FadeIn.duration(160) : RiseIn.duration(AMT_DUR)}
            exiting={fade ? RiseOut.duration(AMT_DUR) : glyphExit}
            layout={comma && countChanged ? commaArc : slideLayout}
          >
            <Text style={{ fontSize, fontWeight: '600', color: '#fff' }}>{char}</Text>
          </Reanimated.View>
        ))}
      </Reanimated.View>
      {/* feathered edges: fade glyphs into the panel bg as they rise in / drop out */}
      <LinearGradient colors={[Colors.dark.background, FEATHER_BG_T]} pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: FEATHER }} />
      <LinearGradient colors={[FEATHER_BG_T, Colors.dark.background]} pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: FEATHER }} />
    </View>
  );
}

export function TradePanel({ isVisible, onClose, artistName, imageUrl, spotifyId, price, color }: TradePanelProps) {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [amount, setAmount] = useState(''); // dollar string
  const [isExecuting, setIsExecuting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [success, setSuccess] = useState<{ contracts: number; side: string; price: string } | null>(null);
  const [openPosition, setOpenPosition] = useState<OpenPosition | null>(null);
  const [armed, setArmed] = useState(false); // past the arm threshold — releasing now places the order

  // ── derived ──
  const amountNum = parseFloat(amount) || 0;
  const contracts = price > 0 ? Math.floor(amountNum / price) : 0;
  const actualDebit = contracts * price;
  const balance = Number(user?.balance) || 0;

  const opposingPosition =
    (side === 'long' && openPosition?.position_type === 'short') ||
    (side === 'short' && openPosition?.position_type === 'long')
      ? openPosition!
      : null;
  const marginReturned = opposingPosition
    ? (opposingPosition.total_cost / opposingPosition.contracts) * Math.min(contracts, opposingPosition.contracts)
    : 0;
  const netTotal = Math.max(0, actualDebit - marginReturned);
  const insufficientFunds = contracts > 0 && side === 'long' && netTotal > balance;
  const disabled = contracts <= 0 || insufficientFunds || !token || isExecuting;

  const sideColor = side === 'long' ? POSITIVE : NEGATIVE;

  const swipeLabel = (() => {
    if (!token) return 'Log in to trade';
    if (contracts <= 0) return 'Choose an amount';
    if (insufficientFunds) return 'Insufficient funds';
    if (isExecuting) return 'Placing order…';
    if (armed) return 'Release to place';
    const verb = side === 'long' ? 'Up' : 'Down';
    return `Swipe to place ${verb} · ${contracts} contract${contracts !== 1 ? 's' : ''} · $${actualDebit.toFixed(2)}`;
  })();
  const subLabel = errorMsg ? errorMsg : contracts > 0 && !disabled ? 'Rounded to whole contracts' : '';

  // ── swipe-to-confirm (PanResponder + Animated, same pattern as the old slider) ──
  const progress = useRef(new Animated.Value(0)).current; // 0 rest → 1 confirmed
  // ── Up/Down toggle transition: 0 = Up, 1 = Down (drives highlight slide + color crossfades) ──
  const sideAnim = useRef(new Animated.Value(0)).current;
  const highlightX = sideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, TOGGLE_SEG_W] });
  const upTextColor = sideAnim.interpolate({ inputRange: [0, 1], outputRange: [POSITIVE, TOGGLE_IDLE] });
  const downTextColor = sideAnim.interpolate({ inputRange: [0, 1], outputRange: [TOGGLE_IDLE, NEGATIVE] });
  const barColor = sideAnim.interpolate({ inputRange: [0, 1], outputRange: [POSITIVE, NEGATIVE] });
  const confirmedRef = useRef(false);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const executeRef = useRef<() => void>(() => {});
  const armedRef = useRef(false);   // gesture-thread twin of `armed`
  const detentRef = useRef(0);      // highest detent reached this drag (one-way ratchet: 0 / 1 / 2)
  const progressRef = useRef(0);    // latest progress value (number twin of `progress`)
  const armPulse = useRef(new Animated.Value(0)).current; // 0 idle → 1 armed (drives the bar-label pulse)
  const armScale = armPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

  // silently drop the armed state (no haptic — used on release/reset, not mid-drag)
  const disarmSilent = () => {
    armedRef.current = false;
    detentRef.current = 0;
    setArmed(false);
    Animated.timing(armPulse, { toValue: 0, duration: 120, useNativeDriver: true }).start();
  };

  const resetSwipe = () => {
    confirmedRef.current = false;
    disarmSilent();
    Animated.spring(progress, { toValue: 0, useNativeDriver: false, tension: 120, friction: 12 }).start();
  };

  // PanResponder velocities are px/ms → progress units/s for seeding the release springs.
  const toProgressVelocity = (vyPxMs: number) => (-vyPxMs * 1000) / SWIPE_THRESHOLD;

  const fire = (vyPxMs = 0) => {
    confirmedRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // spring home seeded with the finger's release velocity — a hard flick slams, a gentle
    // release settles. From the overdrag zone (progress ≥ 1) the seed is zeroed: there it would
    // point AWAY from the target (overshootClamping only clamps on the far side of 1) and lurch
    // the bar upward past the rubber-band cap before settling.
    const seed = progressRef.current >= 1 ? 0 : Math.max(0, toProgressVelocity(vyPxMs));
    Animated.spring(progress, {
      toValue: 1, useNativeDriver: false, tension: 200, friction: 16,
      velocity: seed, overshootClamping: true,
    }).start(({ finished }) => { if (finished) executeRef.current(); });
  };

  const settleBack = (vyPxMs = 0) => {
    Animated.spring(progress, {
      toValue: 0, useNativeDriver: false, tension: 120, friction: 14,
      velocity: toProgressVelocity(vyPxMs), overshootClamping: true,
    }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: (_, g) => !disabledRef.current && g.dy < -3,
      onPanResponderGrant: () => {
        detentRef.current = 0;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (_, g) => {
        if (confirmedRef.current || disabledRef.current) return;
        const raw = -g.dy / SWIPE_THRESHOLD;
        // rubber-band past 100%: overdrag has diminishing returns, asymptote at 1 + OVERDRAG
        const p = raw <= 0 ? 0 : raw <= 1 ? raw : 1 + OVERDRAG * ((raw - 1) / (raw - 1 + OVERDRAG_SOFT));
        progressRef.current = p;
        progress.setValue(p);
        // arm / disarm with hysteresis — medium thunk in, light tick out
        if (!armedRef.current && p >= ARM_AT) {
          armedRef.current = true;
          setArmed(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Animated.spring(armPulse, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }).start();
        } else if (armedRef.current && p < ARM_AT - ARM_HYST) {
          armedRef.current = false;
          setArmed(false);
          Haptics.selectionAsync();
          Animated.timing(armPulse, { toValue: 0, duration: 120, useNativeDriver: true }).start();
        }
        // one-way ratchet detents at ⅓ and ⅔: tick only on upward crossings (no chatter when
        // hovering on a boundary, no re-tick on the way down). Tracked silently while armed so
        // a later disarm can't replay a stale detent as a second haptic.
        const d = Math.min(2, Math.floor(p * 3));
        if (d > detentRef.current) {
          detentRef.current = d;
          if (!armedRef.current) Haptics.selectionAsync();
        }
      },
      onPanResponderRelease: (_, g) => {
        if (confirmedRef.current) return;
        // armed release places the order; a hard flick past ~45% still counts
        const flick = g.vy < -1.1 && -g.dy > SWIPE_THRESHOLD * 0.45;
        if (armedRef.current || flick) fire(g.vy);
        else { disarmSilent(); settleBack(g.vy); }
      },
      onPanResponderTerminate: () => { if (!confirmedRef.current) resetSwipe(); },
    })
  ).current;

  // ── swipe-down-to-close: drag the whole sheet down. Works on ANY part of the
  // panel (keypad included) because the Pan only activates after a clear
  // downward drag — so taps still fall through to the keys / toggle / chips. ──
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeNow = useCallback(() => onCloseRef.current(), []);
  const tick = useCallback(() => Haptics.selectionAsync(), []);
  const ty = useSharedValue(0);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const closePan = Gesture.Pan()
    .activeOffsetY(14)        // begin dragging only after 14px down → taps pass through
    .failOffsetX([-24, 24])   // bail on clearly-horizontal gestures
    .onStart(() => { runOnJS(tick)(); })
    .onUpdate((e) => { ty.value = Math.max(0, e.translationY); })
    .onEnd((e) => {
      if (e.translationY > CLOSE_DRAG || e.velocityY > 800) {
        ty.value = withTiming(SCREEN_H, { duration: 220, easing: Easing.in(Easing.cubic) }, (done) => { if (done) runOnJS(closeNow)(); });
      } else {
        ty.value = withSpring(0, { damping: 22, stiffness: 220, overshootClamping: true });
      }
    });

  // ── data ──
  const fetchOpenPosition = async () => {
    if (!token) return;
    try {
      const res = await fetch(ENDPOINTS.TRADES.MY_POSITIONS(spotifyId), { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setOpenPosition(data.trades?.[0] ?? null);
      }
    } catch {}
  };

  // reset everything each time the panel opens
  useEffect(() => {
    if (isVisible) {
      setAmount('');
      setSide('long');
      sideAnim.setValue(0);
      setErrorMsg(null);
      setShowSuccess(false);
      confirmedRef.current = false;
      armedRef.current = false;
      detentRef.current = 0;
      setArmed(false);
      armPulse.setValue(0);
      progressRef.current = 0;
      progress.setValue(0);
      flipExitUp.value = 0;
      ty.value = 0;
      fetchOpenPosition();
    }
  }, [isVisible]);

  const executeTrade = async () => {
    if (DUMMY_ORDERS) {
      // dummy mode: every order "succeeds" instantly — nothing is sent anywhere
      setSuccess({ contracts, side, price: price.toFixed(2) });
      setShowSuccess(true);
      setAmount('');
      return;
    }
    if (!token || contracts <= 0) { resetSwipe(); return; }
    setIsExecuting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(ENDPOINTS.ORDERS.PLACE, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotify_id: spotifyId, side: side === 'long' ? 'buy' : 'sell', quantity: contracts }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess({ contracts, side, price: data.order?.price?.toFixed(2) ?? price.toFixed(2) });
        setShowSuccess(true);
        setAmount('');
        fetchOpenPosition();
      } else {
        setErrorMsg(data.error || 'Trade failed');
        resetSwipe();
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      resetSwipe();
    } finally {
      setIsExecuting(false);
    }
  };
  executeRef.current = executeTrade;

  // ── keypad / amount handling ──
  const onKey = (k: string) => {
    if (k === '0' && (amount === '' || amount === '0')) return; // leading 0 on $0 → do nothing
    flipExitUp.value = 0; // keypad edits: outgoing glyphs drop out the bottom (see glyphExit)
    Haptics.selectionAsync();
    setErrorMsg(null);
    setAmount((prev) => {
      if (k === 'back') return prev.slice(0, -1);
      if (k === '.') return prev.includes('.') ? prev : prev === '' ? '0.' : prev + '.';
      let next = prev === '0' ? k : prev + k;
      if (next.includes('.') && next.split('.')[1].length > 2) return prev; // max 2 decimals
      if (next.replace('.', '').length > 7) return prev; // cap length
      return next;
    });
  };
  const [flipGen, setFlipGen] = useState(0); // bumped by +$ chips → flips the whole number
  const addAmount = (n: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setErrorMsg(null);
    flipExitUp.value = 1; // chip flip: replaced glyphs rise out the top (see glyphExit)
    setFlipGen((g) => g + 1);
    setAmount((prev) => {
      const v = Math.round(((parseFloat(prev) || 0) + n) * 100) / 100;
      return Number.isInteger(v) ? String(v) : v.toFixed(2);
    });
  };
  const pickSide = (s: 'long' | 'short') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSide(s);
    Animated.spring(sideAnim, { toValue: s === 'long' ? 0 : 1, useNativeDriver: false, friction: 9, tension: 90 }).start();
  };

  const handleSuccessDone = () => {
    setShowSuccess(false);
    resetSwipe();
    onClose();
  };

  // ── animated values for the swipe transition ──
  const blurOpacity = progress; // 0 → 1
  const barHeight = progress.interpolate({ inputRange: [0, 1], outputRange: [BAR_BASE_H, BAR_BASE_H + SWIPE_LIFT] });
  const contentLift = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -SWIPE_LIFT] }); // content rides up with the bar's rising top edge
  // Dim the content as it lifts: the blur samples what's beneath it, so darkening the whites
  // FIRST is what kills the halo/bloom a Gaussian blur puts around bright glyphs.
  const contentFade = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });
  const contentScale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] }); // recede-into-depth as it lifts

  const KEYS: string[][] = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['.', '0', 'back']];

  return (
    <Modal visible={isVisible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.flex}>
        <Reanimated.View style={[styles.sheet, sheetStyle]}>
        {/* ── content (drag down anywhere here to dismiss) ── */}
        <GestureDetector gesture={closePan}>
        <Animated.View style={[styles.content, { paddingTop: insets.top, opacity: contentFade, transform: [{ translateY: contentLift }, { scale: contentScale }] }]}>
          {/* header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}><CloseIcon /></TouchableOpacity>
            <View style={styles.headerCenter}>
              {imageUrl ? (
                <ExpoImage source={{ uri: imageUrl }} style={styles.headerAvatar} contentFit="cover" />
              ) : (
                <View style={styles.headerAvatar} />
              )}
              <Text style={styles.headerTitle} numberOfLines={1}>{artistName}</Text>
            </View>
          </View>

          <View style={{ flex: 1 }} />

          {/* amount (centered, animated rolling digits) */}
          <View style={styles.amountWrap}>
            <AnimatedAmount amount={amount} dim={amountNum === 0} flipGen={flipGen} />
          </View>

          <View style={{ flex: 1 }} />

          {/* Up / Down toggle — sliding highlight + color crossfade */}
          <View style={styles.toggle}>
            <Animated.View style={[styles.toggleHighlight, { transform: [{ translateX: highlightX }] }]} />
            <TouchableOpacity style={styles.toggleSeg} onPress={() => pickSide('long')} activeOpacity={0.8}>
              <Animated.Text style={[styles.toggleText, { color: upTextColor }]}>Up</Animated.Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toggleSeg} onPress={() => pickSide('short')} activeOpacity={0.8}>
              <Animated.Text style={[styles.toggleText, { color: downTextColor }]}>Down</Animated.Text>
            </TouchableOpacity>
          </View>

          {/* info (just above chips) */}
          <Text style={styles.info}>
            1 contract ≈ ${price.toFixed(2)}   ·   ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} available
          </Text>

          {/* quick-add chips */}
          <View style={styles.chips}>
            {[5, 10, 25].map((n) => (
              <TouchableOpacity key={n} style={styles.chip} onPress={() => addAmount(n)}>
                <Text style={styles.chipText}>+${n}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* keypad */}
          <View style={styles.keypad}>
            {KEYS.map((row, ri) => (
              <View key={ri} style={styles.keyRow}>
                {row.map((k) => (
                  <TouchableOpacity key={k} style={styles.key} onPress={() => onKey(k)} activeOpacity={0.6}>
                    <Text style={styles.keyText}>{k === 'back' ? '⌫' : k}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </Animated.View>
        </GestureDetector>

        {/* ── blur that fades in as you swipe up (visual only) ── */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: blurOpacity }]}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        </Animated.View>

        {/* ── swipe-up confirm bar (grows over the blurred content) ── */}
        <Animated.View style={[styles.bar, { height: barHeight, backgroundColor: barColor }]} {...pan.panHandlers}>
          <Animated.View style={[styles.barInner, { transform: [{ scale: armScale }] }]}>
            <ChevronUp />
            <Text style={styles.barLabel}>{swipeLabel}</Text>
            {!!subLabel && <Text style={styles.barSub}>{subLabel}</Text>}
          </Animated.View>
        </Animated.View>

        {/* ── success overlay ── */}
        {showSuccess && success && <SuccessOverlay info={success} color={sideColor} onDone={handleSuccessDone} />}
        </Reanimated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ─── success overlay ──────────────────────────────────────────────────────────
const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHECK_LEN = 21; // ≈ path length of the checkmark stroke (for the self-draw)

function SuccessOverlay({ info, color, onDone }: { info: { contracts: number; side: string; price: string }; color: string; onDone: () => void }) {
  const fade = useRef(new Animated.Value(0)).current;   // backdrop fade-in
  const pop = useRef(new Animated.Value(0)).current;    // dot + glow spring-pop
  const draw = useRef(new Animated.Value(0)).current;   // checkmark self-draw (stroke)
  const echo = useRef(new Animated.Value(0)).current;   // expanding ring echo
  const textIn = useRef(new Animated.Value(0)).current; // title/sub rise + fade
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 140, useNativeDriver: true }).start();
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, tension: 160, friction: 9 }).start();
    // check draws itself once the dot has landed; a light tick when the stroke completes
    Animated.timing(draw, { toValue: 1, duration: 320, delay: 160, easing: RNEasing.out(RNEasing.cubic), useNativeDriver: false }).start(({ finished }) => {
      if (finished) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });
    Animated.timing(echo, { toValue: 1, duration: 600, delay: 220, easing: RNEasing.out(RNEasing.cubic), useNativeDriver: true }).start();
    Animated.timing(textIn, { toValue: 1, duration: 260, delay: 320, easing: RNEasing.out(RNEasing.cubic), useNativeDriver: true }).start();
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, []);
  const popScale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const echoScale = echo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const echoOpacity = echo.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.45, 0] });
  const textY = textIn.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.successWrap, { opacity: fade }]}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <Animated.View style={[styles.successEcho, { borderColor: color, opacity: echoOpacity, transform: [{ scale: echoScale }] }]} />
          <Animated.View style={[styles.successGlow, { backgroundColor: color + '22', marginBottom: 0, transform: [{ scale: popScale }] }]}>
            <View style={[styles.successDot, { backgroundColor: color }]}>
              <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                <AnimatedPath
                  d="M5 13l4 4L19 7"
                  stroke="#000" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray={`${CHECK_LEN}`}
                  strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [CHECK_LEN, 0] })}
                />
              </Svg>
            </View>
          </Animated.View>
        </View>
        <Animated.View style={{ alignItems: 'center', opacity: textIn, transform: [{ translateY: textY }] }}>
          <Text style={styles.successTitle}>Order placed</Text>
          <Text style={styles.successSub}>
            {info.contracts} contract{info.contracts !== 1 ? 's' : ''} · {info.side === 'long' ? 'Up' : 'Down'} · ${info.price}
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: Colors.dark.background },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: BAR_BASE_H + 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52 },
  closeBtn: { position: 'absolute', left: 0, top: 0, bottom: 0, justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: '76%' }, // gap matches artist chart nameHeader
  headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#27272a' }, // size matches artist chart artistAvatar
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '400', letterSpacing: -0.6, flexShrink: 1 }, // matches artist chart largeName

  amountWrap: { alignItems: 'center' },
  amount: { color: '#fff', fontSize: 76, fontWeight: '800', letterSpacing: -2 },

  toggle: { flexDirection: 'row', alignSelf: 'center', marginBottom: 18, backgroundColor: '#1c1c1f', borderRadius: 999, padding: 4 },
  toggleHighlight: { position: 'absolute', left: 4, top: 4, width: TOGGLE_SEG_W, height: TOGGLE_SEG_H, backgroundColor: '#2c2c30', borderRadius: 999 },
  toggleSeg: { width: TOGGLE_SEG_W, height: TOGGLE_SEG_H, alignItems: 'center', justifyContent: 'center' },
  toggleText: { fontSize: 16, fontWeight: '700' },

  info: { textAlign: 'center', color: '#71717a', fontSize: 13, marginBottom: 16 },

  chips: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  chip: { paddingVertical: 8, paddingHorizontal: 18 },
  chipText: { color: '#a1a1aa', fontSize: 18, fontWeight: '600' },

  keypad: {},
  keyRow: { flexDirection: 'row' },
  key: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  keyText: { color: '#fff', fontSize: 26, fontWeight: '500' },

  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  barInner: { paddingTop: 14, alignItems: 'center' },
  barLabel: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 4, paddingHorizontal: 24, textAlign: 'center' },
  barSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },

  successWrap: { backgroundColor: Colors.dark.background, alignItems: 'center', justifyContent: 'center' },
  successGlow: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successEcho: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 1.5 },
  successDot: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  successTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  successSub: { color: '#71717a', fontSize: 15 },
});
