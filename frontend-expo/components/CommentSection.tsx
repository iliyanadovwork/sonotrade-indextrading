import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal,
  StyleSheet, Image, FlatList, KeyboardAvoidingView, Animated,
  Platform, Pressable,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { GlyphDrawLoader } from '@/components/GlyphDrawLoader';
import { UndoToast } from '@/components/UndoToast';
import { useDeleteAnimation } from '@/hooks/useDeleteAnimation';
import * as Haptics from 'expo-haptics';
import { VerifiedBadge, OGBadge } from '@/components/UserBadges';
import { useAuth } from '@/context/AuthContext';
import { ENDPOINTS } from '@/constants/API';
import { Colors } from '@/constants/theme';
import { POSITIVE, NEGATIVE } from '@/constants/colors';

const GIPHY_KEY = 'IWgtAtuxJnea1tRbdy4nVnEjW96RrWSj';

// ─── Lucide-matching SVG Icons ────────────────────────────────────────────────

function HeartIcon({ size = 18, color = '#7a7a7a', filled = false }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </Svg>
  );
}

function MessageCircleIcon({ size = 16, color = '#7a7a7a' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </Svg>
  );
}

function Trash2Icon({ size = 16, color = '#7a7a7a' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18" />
      <Path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <Path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <Path d="M10 11v6" />
      <Path d="M14 11v6" />
    </Svg>
  );
}

function XIcon({ size = 16, color = '#7a7a7a' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 6 6 18" />
      <Path d="m6 6 12 12" />
    </Svg>
  );
}

function ArrowLeftIcon({ size = 22, color = '#fff' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m12 19-7-7 7-7" />
      <Path d="M19 12H5" />
    </Svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommentUser { _id: string; username?: string; avatar_url?: string | null }
interface Comment {
  _id: string;
  userId: CommentUser;
  eventId: string;
  content: string;
  parentId?: string;
  likesCount: number;
  isLikedByCurrentUser: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── GifImage ─────────────────────────────────────────────────────────────────

function GifImage({ uri, style }: { uri: string; style?: object }) {
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  return (
    <View style={[{ borderRadius: 6, overflow: 'hidden', marginTop: 8, marginBottom: 0 }, style]}>
      <ExpoImage
        source={{ uri }}
        style={{ width: '100%', aspectRatio }}
        contentFit="fill"
        onLoad={(e) => {
          if (e.source.width && e.source.height) {
            setAspectRatio(e.source.width / e.source.height);
          }
        }}
      />
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const extractGifUrls = (text: string) => text.match(/(https?:\/\/[^\s]+\.gif)/g) || [];
const removeGifUrls = (text: string) => text.replace(/https?:\/\/[^\s]+\.gif/g, '').trim();

const TRADE_REGEX = /\[\[TRADE:(\{.*?\})\]\]/s;
interface TradeEmbed { a: string; n?: string; s: 'long' | 'short'; c: number; e: number; x: number; p: number; pc: number; o?: boolean }
function parseTrade(content: string): { trade: TradeEmbed | null; text: string } {
  const match = content.match(TRADE_REGEX);
  if (!match) return { trade: null, text: content };
  try { return { trade: JSON.parse(match[1]), text: content.replace(TRADE_REGEX, '').trim() }; }
  catch { return { trade: null, text: content }; }
}

function BetSlipCard({ trade }: { trade: TradeEmbed }) {
  const isLong = trade.s === 'long';
  const isWin = trade.p >= 0;
  const pnlAbs = Math.abs(trade.p);
  const pnlPctAbs = Math.abs(trade.pc);
  return (
    <View style={betSlipStyles.card}>
      <View style={betSlipStyles.topRow}>
        <Text style={betSlipStyles.artist} numberOfLines={1}>{trade.n ?? trade.a}</Text>
        <View style={[betSlipStyles.badge, isLong ? betSlipStyles.badgeLong : betSlipStyles.badgeShort]}>
          <Text style={[betSlipStyles.badgeText, { color: isLong ? POSITIVE : NEGATIVE }]}>{trade.s.toUpperCase()}</Text>
        </View>
      </View>
      <View style={betSlipStyles.priceRow}>
        <Text style={betSlipStyles.priceDim}>${trade.e.toFixed(2)}</Text>
        <Text style={betSlipStyles.priceDim}> → </Text>
        <Text style={betSlipStyles.priceExit}>${trade.x.toFixed(2)}</Text>
        <Text style={betSlipStyles.contracts}>{trade.c} {trade.c === 1 ? 'contract' : 'contracts'}</Text>
      </View>
      <Text style={[betSlipStyles.pnl, { color: isWin ? POSITIVE : NEGATIVE }]}>
        {isWin ? '+' : '-'}${pnlAbs.toFixed(2)}
        <Text style={betSlipStyles.pnlPct}> ({isWin ? '+' : '-'}{pnlPctAbs.toFixed(2)}%)</Text>
      </Text>
      <Text style={betSlipStyles.label}>{trade.o ? 'Open Position' : 'Closed Trade'}</Text>
    </View>
  );
}

interface ClosedTrade { id: string; spotify_id: string; artist_name: string; position_type: 'long' | 'short'; contracts: number; entry_price: number; current_price: number; total_cost: number; unrealized_pnl: number; closed_at: string }

function timeAgo(dateStr: string): string {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7); if (w < 4) return `${w}w ago`;
  const mo = Math.floor(d / 30); if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

// ─── Trade Picker Modal ───────────────────────────────────────────────────────

function TradePickerModal({ visible, onClose, onSelect, token }: {
  visible: boolean; onClose: () => void; onSelect: (trade: TradeEmbed) => void; token: string | null;
}) {
  const [trades, setTrades] = useState<ClosedTrade[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !token) return;
    setLoading(true);
    fetch(ENDPOINTS.TRADES.HISTORY, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setTrades(d.history || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, token]);

  const handleSelect = (t: ClosedTrade) => {
    const pc = t.total_cost > 0 ? (t.unrealized_pnl / t.total_cost) * 100 : 0;
    onSelect({ a: t.spotify_id, n: t.artist_name, s: t.position_type, c: t.contracts, e: t.entry_price, x: t.current_price, p: t.unrealized_pnl, pc });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={tradePickerStyles.overlay} onPress={onClose}>
        <Pressable style={tradePickerStyles.sheet} onStartShouldSetResponder={() => true}>
          <View style={tradePickerStyles.handle} />
          <View style={tradePickerStyles.header}>
            <Text style={tradePickerStyles.title}>Share a Closed Trade</Text>
            <TouchableOpacity onPress={onClose}><XIcon size={18} color="#7a7a7a" /></TouchableOpacity>
          </View>
          {loading ? (
            <GlyphDrawLoader width={24} />
          ) : trades.length === 0 ? (
            <Text style={tradePickerStyles.empty}>No closed trades found.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {trades.map(t => {
                const isLong = t.position_type === 'long';
                const isWin = t.unrealized_pnl >= 0;
                const pc = t.total_cost > 0 ? (t.unrealized_pnl / t.total_cost) * 100 : 0;
                return (
                  <TouchableOpacity key={t.id} style={tradePickerStyles.row} onPress={() => handleSelect(t)} activeOpacity={0.7}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Text style={tradePickerStyles.rowArtist}>{t.artist_name}</Text>
                        <View style={[betSlipStyles.badge, isLong ? betSlipStyles.badgeLong : betSlipStyles.badgeShort]}>
                          <Text style={[betSlipStyles.badgeText, { color: isLong ? POSITIVE : NEGATIVE }]}>{t.position_type.toUpperCase()}</Text>
                        </View>
                      </View>
                      <Text style={tradePickerStyles.rowSub}>${(t.entry_price ?? 0).toFixed(2)} → ${(t.current_price ?? 0).toFixed(2)} · {t.contracts} contracts</Text>
                    </View>
                    <Text style={[tradePickerStyles.rowPnl, { color: isWin ? POSITIVE : NEGATIVE }]}>
                      {isWin ? '+' : '-'}${Math.abs(t.unrealized_pnl ?? 0).toFixed(2)}
                      {'\n'}<Text style={tradePickerStyles.rowPct}>({isWin ? '+' : '-'}{Math.abs(pc).toFixed(1)}%)</Text>
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const tradePickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.dark.background, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 16, paddingBottom: 32,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#3f3f46', alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { color: '#fff', fontSize: 15, fontWeight: '600' },
  empty: { color: '#71717a', fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  rowArtist: { color: '#fff', fontSize: 13, fontWeight: '600' },
  rowSub: { color: '#71717a', fontSize: 12 },
  rowPnl: { fontSize: 13, fontWeight: '600', textAlign: 'right' },
  rowPct: { fontSize: 11, fontWeight: '400' },
});

// ─── Position Picker Modal ────────────────────────────────────────────────────

interface OpenPosition { id: string; spotify_id: string; artist_name: string; position_type: 'long' | 'short'; contracts: number; entry_price: number; current_price: number; total_cost: number; unrealized_pnl: number }

function PositionPickerModal({ visible, onClose, onSelect, token }: {
  visible: boolean; onClose: () => void; onSelect: (trade: TradeEmbed) => void; token: string | null;
}) {
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !token) return;
    setLoading(true);
    fetch(ENDPOINTS.TRADES.ALL_POSITIONS, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setPositions(d.trades || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, token]);

  const handleSelect = (pos: OpenPosition) => {
    const pc = pos.total_cost > 0 ? (pos.unrealized_pnl / pos.total_cost) * 100 : 0;
    onSelect({ a: pos.spotify_id, n: pos.artist_name, s: pos.position_type, c: pos.contracts, e: pos.entry_price, x: pos.current_price ?? pos.entry_price, p: pos.unrealized_pnl ?? 0, pc, o: true });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={tradePickerStyles.overlay} onPress={onClose}>
        <Pressable style={tradePickerStyles.sheet} onStartShouldSetResponder={() => true}>
          <View style={tradePickerStyles.handle} />
          <View style={tradePickerStyles.header}>
            <Text style={tradePickerStyles.title}>Share an Open Position</Text>
            <TouchableOpacity onPress={onClose}><XIcon size={18} color="#7a7a7a" /></TouchableOpacity>
          </View>
          {loading ? (
            <GlyphDrawLoader width={24} />
          ) : positions.length === 0 ? (
            <Text style={tradePickerStyles.empty}>No open positions found.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {positions.map(pos => {
                const isLong = pos.position_type === 'long';
                const pnl = pos.unrealized_pnl ?? 0;
                const isWin = pnl >= 0;
                const pc = pos.total_cost > 0 ? (pnl / pos.total_cost) * 100 : 0;
                return (
                  <TouchableOpacity key={pos.id} style={tradePickerStyles.row} onPress={() => handleSelect(pos)} activeOpacity={0.7}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Text style={tradePickerStyles.rowArtist}>{pos.artist_name}</Text>
                        <View style={[betSlipStyles.badge, isLong ? betSlipStyles.badgeLong : betSlipStyles.badgeShort]}>
                          <Text style={[betSlipStyles.badgeText, { color: isLong ? POSITIVE : NEGATIVE }]}>{pos.position_type.toUpperCase()}</Text>
                        </View>
                      </View>
                      <Text style={tradePickerStyles.rowSub}>Entry ${pos.entry_price.toFixed(2)} · {pos.contracts} contracts</Text>
                    </View>
                    <Text style={[tradePickerStyles.rowPnl, { color: isWin ? POSITIVE : NEGATIVE }]}>
                      {isWin ? '+' : '-'}${Math.abs(pnl).toFixed(2)}
                      {'\n'}<Text style={tradePickerStyles.rowPct}>({isWin ? '+' : '-'}{Math.abs(pc).toFixed(1)}%)</Text>
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── GIF Picker Modal ─────────────────────────────────────────────────────────

function GifPickerModal({ visible, onClose, onSelect }: {
  visible: boolean; onClose: () => void; onSelect: (url: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=10`);
      const json = await res.json();
      setResults(json.data || []);
    } catch { } finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={gifStyles.overlay} onPress={onClose}>
        <Pressable style={gifStyles.sheet} onStartShouldSetResponder={() => true}>
          <View style={gifStyles.handle} />
          <View style={gifStyles.header}>
            <Text style={gifStyles.title}>Search GIFs</Text>
            <TouchableOpacity onPress={onClose}>
              <XIcon size={18} color="#7a7a7a" />
            </TouchableOpacity>
          </View>
          <View style={gifStyles.searchRow}>
            <TextInput
              style={gifStyles.input}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={search}
              placeholder="Search GIFs..."
              placeholderTextColor="#7a7a7a"
              returnKeyType="search"
            />
            <TouchableOpacity style={gifStyles.searchBtn} onPress={search}>
              <Text style={gifStyles.searchBtnText}>Search</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <GlyphDrawLoader width={24} />
          ) : (
            <FlatList
        showsVerticalScrollIndicator={false}
              data={results}
              numColumns={2}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={gifStyles.gifItem}
                  onPress={() => { onSelect(item.images.fixed_height.url); onClose(); }}
                >
                  <Image source={{ uri: item.images.fixed_height_small.url }} style={gifStyles.gifImage} />
                </TouchableOpacity>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Reply Modal ──────────────────────────────────────────────────────────────

function ReplyModal({ visible, parentComment, eventId, onClose, onReplyAdded, onReplyFailed }: {
  visible: boolean;
  parentComment: Comment | null;
  eventId: string;
  onClose: () => void;
  onReplyAdded: (c: Comment) => void;
  onReplyFailed?: (id: string) => void;
}) {
  const { token, user } = useAuth();
  const [content, setContent] = useState('');
  const [selectedGif, setSelectedGif] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<TradeEmbed | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showTradePicker, setShowTradePicker] = useState(false);
  const [showPositionPicker, setShowPositionPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!parentComment) return null;

  const displayName = parentComment.userId?.username || 'Anonymous';
  const { trade: parentTrade, text: parentText } = parseTrade(parentComment.content);

  const handleSubmit = async () => {
    if (!content.trim() && !selectedGif && !selectedTrade) return;
    let combined = content.trim();
    if (selectedGif) combined = combined ? `${combined}\n${selectedGif}` : selectedGif;
    if (selectedTrade) combined = combined ? `${combined}\n[[TRADE:${JSON.stringify(selectedTrade)}]]` : `[[TRADE:${JSON.stringify(selectedTrade)}]]`;
    const optimisticId = `temp-${Date.now()}`;
    const optimistic: Comment = {
      _id: optimisticId,
      content: combined,
      userId: { _id: user?.id || '', username: user?.username || 'You' },
      eventId,
      parentId: parentComment.parentId || parentComment._id,
      likesCount: 0,
      isLikedByCurrentUser: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onReplyAdded(optimistic);
    setContent('');
    setSelectedGif(null);
    setSelectedTrade(null);
    onClose();

    try {
      const res = await fetch(ENDPOINTS.COMMENTS.CREATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId, content: combined, replyToCommentId: parentComment.parentId || parentComment._id }),
      });
      const data = await res.json();
      if (data.success && data.comment) {
        onReplyAdded(data.comment);
      } else {
        onReplyFailed?.(optimisticId);
      }
    } catch {
      onReplyFailed?.(optimisticId);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={replyStyles.overlay} onPress={onClose}>
          <Pressable style={replyStyles.sheet} onStartShouldSetResponder={() => true}>
            {/* Header */}
            <View style={replyStyles.header}>
              <TouchableOpacity onPress={onClose}>
                <ArrowLeftIcon size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Parent comment */}
            <View style={replyStyles.parentRow}>
              <View style={replyStyles.avatar}>
                {parentComment.userId?.avatar_url
                  ? <ExpoImage source={{ uri: parentComment.userId.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" />
                  : <Text style={replyStyles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <View style={replyStyles.nameRow}>
                  <Text style={replyStyles.name}>{displayName}</Text>
                  <VerifiedBadge />
                  <OGBadge />
                  <Text style={replyStyles.time}>{timeAgo(parentComment.createdAt)}</Text>
                </View>
                {parentText ? <Text style={replyStyles.parentContent}>{removeGifUrls(parentText)}</Text> : null}
                {parentTrade && <BetSlipCard trade={parentTrade} />}
                <Text style={replyStyles.replyingTo}>Replying to <Text style={{ color: '#fff' }}>@{displayName}</Text></Text>
              </View>
            </View>

            {/* Reply input */}
            <TextInput
              style={replyStyles.input}
              value={content}
              onChangeText={setContent}
              placeholder="Post your reply"
              placeholderTextColor="#7a7a7a"
              multiline
              maxLength={2000}
              autoFocus
            />
            {selectedGif && <GifImage uri={selectedGif} style={{ marginBottom: 8 }} />}
            {selectedTrade && <BetSlipCard trade={selectedTrade} />}

            <View style={replyStyles.footer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <TouchableOpacity onPress={() => setShowGifPicker(true)}>
                  {selectedGif
                    ? <Text style={replyStyles.gifLabel} onPress={() => setSelectedGif(null)}>Delete GIF</Text>
                    : <Text style={replyStyles.gifLabel}>GIF</Text>}
                </TouchableOpacity>
                {selectedTrade ? (
                  <TouchableOpacity onPress={() => setSelectedTrade(null)}>
                    <Text style={replyStyles.gifLabel}>Remove {selectedTrade.o ? 'Position' : 'Trade'}</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity onPress={() => setShowTradePicker(true)}>
                      <Text style={replyStyles.gifLabel}>Trade</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowPositionPicker(true)}>
                      <Text style={replyStyles.gifLabel}>Position</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
              <View style={replyStyles.footerRight}>
                <Text style={replyStyles.charCount}>{2000 - content.length} left</Text>
                <TouchableOpacity
                  style={[replyStyles.postBtn, (!content.trim() && !selectedGif && !selectedTrade) && { opacity: 0.4 }]}
                  onPress={handleSubmit}
                  disabled={submitting || (!content.trim() && !selectedGif && !selectedTrade)}
                >
                  <Text style={replyStyles.postBtnText}>{submitting ? '...' : 'Reply'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
      <GifPickerModal visible={showGifPicker} onClose={() => setShowGifPicker(false)} onSelect={setSelectedGif} />
      <TradePickerModal visible={showTradePicker} onClose={() => setShowTradePicker(false)} onSelect={setSelectedTrade} token={token} />
      <PositionPickerModal visible={showPositionPicker} onClose={() => setShowPositionPicker(false)} onSelect={setSelectedTrade} token={token} />
    </Modal>
  );
}

// ─── Single Comment ───────────────────────────────────────────────────────────

function CommentItem({ comment, currentUserId, token, onReply, onDelete, isReply }: {
  comment: Comment;
  currentUserId?: string;
  token: string | null;
  onReply: (c: Comment) => void;
  onDelete: (id: string) => void;
  isReply?: boolean;
}) {
  const [likesCount, setLikesCount] = useState(comment.likesCount || 0);
  const [isLiked, setIsLiked] = useState(comment.isLikedByCurrentUser || false);
  const [liking, setLiking] = useState(false);

  const displayName = comment.userId?.username || 'Anonymous';
  const isOwner = currentUserId && comment.userId?._id === currentUserId;
  const { trade, text: contentWithoutTrade } = parseTrade(comment.content);
  const gifUrls = extractGifUrls(contentWithoutTrade);
  const textContent = removeGifUrls(contentWithoutTrade);
  const { animatedStyle, triggerDelete } = useDeleteAnimation(() => onDelete(comment._id));

  const handleLike = async () => {
    if (!token || liking) return;
    const prevLiked = isLiked;
    const prevCount = likesCount;
    setIsLiked(!prevLiked);
    setLikesCount(prevLiked ? prevCount - 1 : prevCount + 1);
    setLiking(true);
    try {
      const res = await fetch(ENDPOINTS.COMMENTS.LIKE(comment._id), {
        method: prevLiked ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setLikesCount(data.likes);
      else { setIsLiked(prevLiked); setLikesCount(prevCount); }
    } catch { setIsLiked(prevLiked); setLikesCount(prevCount); } finally { setLiking(false); }
  };

  return (
    <Animated.View style={[commentStyles.wrapper, isReply && commentStyles.replyWrapper, animatedStyle]}>
      <View style={commentStyles.avatar}>
        {comment.userId?.avatar_url
          ? <ExpoImage source={{ uri: comment.userId.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" />
          : <Text style={commentStyles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        {isReply ? (
          <View style={commentStyles.replyBody}>
            <View style={commentStyles.nameRow}>
              <Text style={commentStyles.name}>{displayName}</Text>
              <VerifiedBadge />
              <OGBadge />
              <Text style={commentStyles.time}>{timeAgo(comment.createdAt)}</Text>
            </View>
            {textContent ? <Text style={commentStyles.content}>{textContent}</Text> : null}
            {gifUrls.map((url, i) => (<GifImage key={i} uri={url} />))}
            {trade && <BetSlipCard trade={trade} />}
          </View>
        ) : (
          <>
            <View style={commentStyles.nameRow}>
              <Text style={commentStyles.name}>{displayName}</Text>
              <VerifiedBadge />
              <OGBadge />
              <Text style={commentStyles.time}>{timeAgo(comment.createdAt)}</Text>
            </View>
            {textContent ? <Text style={commentStyles.content}>{textContent}</Text> : null}
            {gifUrls.map((url, i) => (<GifImage key={i} uri={url} />))}
            {trade && <BetSlipCard trade={trade} />}
          </>
        )}
        <View style={commentStyles.actions}>
          <TouchableOpacity
            style={commentStyles.actionBtn}
            onPress={handleLike}
            disabled={!token || liking}
            activeOpacity={0.7}
          >
            <HeartIcon size={18} color={isLiked ? NEGATIVE : '#7a7a7a'} filled={isLiked} />
            {likesCount > 0 && <Text style={[commentStyles.actionCount, isLiked && { color: NEGATIVE }]}>{likesCount}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={commentStyles.actionBtn} onPress={() => onReply(comment)} activeOpacity={0.7}>
            <MessageCircleIcon size={16} color="#7a7a7a" />
          </TouchableOpacity>
          {isOwner && (
            <TouchableOpacity style={commentStyles.actionBtn} onPress={triggerDelete} activeOpacity={0.7}>
              <Trash2Icon size={16} color="#7a7a7a" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Comment Section ──────────────────────────────────────────────────────────

export default function CommentSection({ artistName, spotifyId }: { artistName: string; spotifyId: string }) {
  const router = useRouter();
  const { token, user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [selectedGif, setSelectedGif] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<TradeEmbed | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showTradePicker, setShowTradePicker] = useState(false);
  const [showPositionPicker, setShowPositionPicker] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null);
  const [undoComment, setUndoComment] = useState<{ id: string; data: Comment; index: number } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(ENDPOINTS.COMMENTS.LIST(spotifyId), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) setComments(data.comments || []);
    } catch { } finally { setLoading(false); }
  }, [artistName, token]);

  useEffect(() => { fetchComments(); }, [artistName]);

  const handlePost = async () => {
    if (!content.trim() && !selectedGif && !selectedTrade) return;
    let combined = content.trim();
    if (selectedGif) combined = combined ? `${combined}\n${selectedGif}` : selectedGif;
    if (selectedTrade) combined = combined ? `${combined}\n[[TRADE:${JSON.stringify(selectedTrade)}]]` : `[[TRADE:${JSON.stringify(selectedTrade)}]]`;
    setSubmitting(true);
    try {
      const res = await fetch(ENDPOINTS.COMMENTS.CREATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId: spotifyId, content: combined }),
      });
      const data = await res.json();
      if (data.success && data.comment) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setComments((prev) => [data.comment, ...prev]);
        setContent('');
        setSelectedGif(null);
        setSelectedTrade(null);
      }
    } catch { } finally { setSubmitting(false); }
  };

  const handleReplyAdded = (newReply: Comment) => {
    setComments((prev) => {
      if (!newReply._id.startsWith('temp-')) {
        const idx = prev.findIndex((c) => c._id.startsWith('temp-') && c.parentId === newReply.parentId);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = newReply;
          return updated;
        }
      }
      return [...prev, newReply];
    });
  };

  const handleDelete = (id: string) => {
    setComments(prev => {
      const index = prev.findIndex(c => c._id === id);
      const comment = prev[index];
      if (!comment) return prev;
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setUndoComment({ id, data: comment, index });
      undoTimerRef.current = setTimeout(async () => {
        try {
          await fetch(ENDPOINTS.COMMENTS.DELETE(id), {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch { }
        setUndoComment(null);
      }, 4000);
      return prev.filter(c => c._id !== id);
    });
  };

  const handleUndoDelete = () => {
    if (!undoComment) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setComments(prev => {
      const next = [...prev];
      next.splice(undoComment.index, 0, undoComment.data);
      return next;
    });
    setUndoComment(null);
  };

  const topLevel = comments.filter((c) => !c.parentId);

  return (
    <View style={[styles.container, { position: 'relative' }]}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Comments</Text>
      </View>

      {/* Post form */}
      <View style={styles.form}>
        {token ? (
          <TextInput
            style={styles.formInput}
            value={content}
            onChangeText={setContent}
            placeholder="What's your take?"
            placeholderTextColor="#7a7a7a"
            multiline
            maxLength={500}
          />
        ) : (
          // guests: tapping the composer goes to sign-in (and returns here after)
          <TouchableOpacity onPress={() => router.push('/welcome?back=1')} activeOpacity={0.8}>
            <Text style={[styles.formInput, { color: '#7a7a7a' }]}>Sign in to comment</Text>
          </TouchableOpacity>
        )}
        {selectedGif && <GifImage uri={selectedGif} style={{ marginTop: 8 }} />}
        {selectedTrade && <BetSlipCard trade={selectedTrade} />}
        <View style={styles.formFooter}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <TouchableOpacity onPress={() => token && setShowGifPicker(true)}>
              {selectedGif
                ? <Text style={styles.gifBtn} onPress={() => setSelectedGif(null)}>Delete GIF</Text>
                : <Text style={[styles.gifBtn, !token && { opacity: 0.4 }]}>GIF</Text>}
            </TouchableOpacity>
            {selectedTrade ? (
              <TouchableOpacity onPress={() => setSelectedTrade(null)}>
                <Text style={styles.gifBtn}>Remove {selectedTrade.o ? 'Position' : 'Trade'}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity onPress={() => token && setShowTradePicker(true)}>
                  <Text style={[styles.gifBtn, !token && { opacity: 0.4 }]}>Trade</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => token && setShowPositionPicker(true)}>
                  <Text style={[styles.gifBtn, !token && { opacity: 0.4 }]}>Position</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          <View style={styles.formRight}>
            <Text style={styles.charCount}>{2000 - content.length} left</Text>
            <TouchableOpacity
              style={[styles.postBtn, (!content.trim() && !selectedGif && !selectedTrade || !token) && { opacity: 0.4 }]}
              onPress={handlePost}
              disabled={submitting || (!content.trim() && !selectedGif && !selectedTrade) || !token}
            >
              <Text style={styles.postBtnText}>{submitting ? '...' : 'Post'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Comments list */}
      {loading ? (
        <GlyphDrawLoader width={24} />
      ) : (
        <View>
          {topLevel.map((comment, index) => {
            const replies = comments.filter((r) => r.parentId === comment._id);
            return (
              <View key={comment._id}>
                {index > 0 && <View style={styles.separator} />}
                <CommentItem
                  comment={comment}
                  currentUserId={user?.id}
                  token={token}
                  onReply={setReplyTarget}
                  onDelete={handleDelete}
                />
                {replies.length > 0 && (
                  <View style={styles.repliesIndent}>
                    {replies.map((reply) => (
                      <CommentItem
                        key={reply._id}
                        comment={reply}
                        currentUserId={user?.id}
                        token={token}
                        onReply={setReplyTarget}
                        onDelete={handleDelete}
                        isReply
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <GifPickerModal
        visible={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelect={setSelectedGif}
      />
      <TradePickerModal
        visible={showTradePicker}
        onClose={() => setShowTradePicker(false)}
        onSelect={setSelectedTrade}
        token={token}
      />
      <PositionPickerModal
        visible={showPositionPicker}
        onClose={() => setShowPositionPicker(false)}
        onSelect={setSelectedTrade}
        token={token}
      />
      <ReplyModal
        visible={!!replyTarget}
        parentComment={replyTarget}
        eventId={spotifyId}
        onClose={() => setReplyTarget(null)}
        onReplyAdded={handleReplyAdded}
        onReplyFailed={(id) => setComments((prev) => prev.filter((c) => c._id !== id))}
      />
      <UndoToast
        visible={!!undoComment}
        message="Comment deleted"
        onUndo={handleUndoDelete}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#1c1c1e',
  },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '400', letterSpacing: -0.4 },
  form: {
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  formInput: {
    color: '#fff',
    fontSize: 13,
    minHeight: 27,
    paddingVertical: 0,
  },
  formFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  gifBtn: { color: '#7a7a7a', fontSize: 12, fontWeight: '600' },
  formRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  charCount: { color: '#7a7a7a', fontSize: 12 },
  postBtn: {
    backgroundColor: '#fff',
    borderRadius: 99,
    paddingHorizontal: 22,
    paddingVertical: 11,
    minWidth: 72,
    alignItems: 'center',
  },
  postBtnText: { color: '#000', fontSize: 13, fontWeight: '500' },
  repliesIndent: { marginLeft: 40, paddingLeft: 16 },
  separator: { height: 1, backgroundColor: '#1c1c1e', marginHorizontal: -16, marginTop: 8, marginBottom: 12 },
});

const commentStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 4,
  },
  replyWrapper: {},
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { color: '#111', fontWeight: '700', fontSize: 17 },
  replyBody: {
    backgroundColor: '#111111',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222222',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  name: { color: '#fff', fontSize: 13, fontWeight: '600' },
  time: { color: '#7a7a7a', fontSize: 11 },
  content: { color: '#fff', fontSize: 13, lineHeight: 19, marginBottom: 0 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 8, marginBottom: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { color: '#7a7a7a', fontSize: 12, fontWeight: '500' },
});

const replyStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 32,
  },
  header: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#262626', marginBottom: 12 },
  parentRow: { flexDirection: 'row', gap: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#262626', marginBottom: 8 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { color: '#111', fontWeight: '700', fontSize: 17 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  name: { color: '#fff', fontSize: 13, fontWeight: '600' },
  time: { color: '#7a7a7a', fontSize: 11 },
  parentContent: { color: '#fff', fontSize: 14, marginBottom: 4 },
  replyingTo: { color: '#7a7a7a', fontSize: 13, marginTop: 10 },
  input: { color: '#fff', fontSize: 14, minHeight: 48, paddingVertical: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  gifLabel: { color: '#7a7a7a', fontSize: 13, fontWeight: '600' },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  charCount: { color: '#7a7a7a', fontSize: 12 },
  postBtn: {
    backgroundColor: '#fff',
    borderRadius: 99,
    paddingHorizontal: 22,
    paddingVertical: 11,
    minWidth: 72,
    alignItems: 'center',
  },
  postBtnText: { color: '#000', fontSize: 13, fontWeight: '500' },
});

const gifStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 32,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#3f3f46', alignSelf: 'center', marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { color: '#fff', fontSize: 15, fontWeight: '600' },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: {
    flex: 1, backgroundColor: '#171717', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: '#fff', fontSize: 14,
  },
  searchBtn: {
    backgroundColor: '#fff', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'center',
  },
  searchBtnText: { color: '#000', fontSize: 13, fontWeight: '500' },
  gifItem: { flex: 1, margin: 4 },
  gifImage: { width: '100%', height: 100, borderRadius: 6 },
});

const betSlipStyles = StyleSheet.create({
  card: {
    marginTop: 8,
    marginBottom: 0,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222222',
    backgroundColor: '#111111',
    padding: 12,
    maxWidth: 260,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  artist: { color: '#fff', fontWeight: '600', fontSize: 13, flex: 1, marginRight: 8 },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  badgeLong: { backgroundColor: 'rgba(4,223,162,0.15)' },
  badgeShort: { backgroundColor: 'rgba(255,75,75,0.15)' },
  badgeText: { fontSize: 10, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  priceDim: { color: '#71717a', fontSize: 12 },
  priceExit: { color: '#d4d4d8', fontSize: 12 },
  contracts: { color: '#71717a', fontSize: 12, marginLeft: 'auto' },
  pnl: { fontSize: 13, fontWeight: '600' },
  pnlPct: { fontSize: 11, fontWeight: '400', opacity: 0.8 },
  label: { color: '#52525b', fontSize: 10, marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 },
});
