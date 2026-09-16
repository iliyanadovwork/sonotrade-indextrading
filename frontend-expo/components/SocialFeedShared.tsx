import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal,
  StyleSheet, Image, FlatList, Animated, Easing, Keyboard,
  Platform, Pressable, KeyboardAvoidingView,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { GlyphDrawLoader } from '@/components/GlyphDrawLoader';
import { UndoToast } from '@/components/UndoToast';
import { useDeleteAnimation } from '@/hooks/useDeleteAnimation';
import * as Haptics from 'expo-haptics';
import { VerifiedBadge, OGBadge } from '@/components/UserBadges';
import { ENDPOINTS } from '@/constants/API';
import { Colors } from '@/constants/theme';
import { POSITIVE, NEGATIVE } from '@/constants/colors';

const GIPHY_KEY = 'IWgtAtuxJnea1tRbdy4nVnEjW96RrWSj';

// ─── Icons ────────────────────────────────────────────────────────────────────

export function HeartIcon({ size = 18, color = '#7a7a7a', filled = false }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </Svg>
  );
}

export function MessageCircleIcon({ size = 16, color = '#7a7a7a' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </Svg>
  );
}

export function Trash2Icon({ size = 16, color = '#7a7a7a' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18" /><Path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <Path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><Path d="M10 11v6" /><Path d="M14 11v6" />
    </Svg>
  );
}

export function XIcon({ size = 16, color = '#7a7a7a' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 6 6 18" /><Path d="m6 6 12 12" />
    </Svg>
  );
}

export function ArrowLeftIcon({ size = 22, color = '#fff' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m12 19-7-7 7-7" /><Path d="M19 12H5" />
    </Svg>
  );
}

// ─── ReadMoreText ─────────────────────────────────────────────────────────────

const READ_MORE_LIMIT = 350;

export function ReadMoreText({ text, style }: { text: string; style?: object }) {
  const [expanded, setExpanded] = useState(false);
  if (text.length <= READ_MORE_LIMIT) return <Text style={style}>{text}</Text>;
  return (
    <Text style={style}>
      {expanded ? text : text.slice(0, READ_MORE_LIMIT)}
      <Text style={{ color: '#7a7a7a', fontWeight: '600' }} onPress={() => setExpanded(e => !e)}>
        {expanded ? ' Read less' : '... Read more'}
      </Text>
    </Text>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

const TRADE_REGEX = /\[\[TRADE:(\{.*?\})\]\]/s;
export interface TradeEmbed { a: string; n?: string; s: 'long' | 'short'; c: number; e: number; x: number; p: number; pc: number; o?: boolean }

export function parseTrade(content: string): { trade: TradeEmbed | null; text: string } {
  const match = content.match(TRADE_REGEX);
  if (!match) return { trade: null, text: content };
  try { return { trade: JSON.parse(match[1]), text: content.replace(TRADE_REGEX, '').trim() }; }
  catch { return { trade: null, text: content }; }
}

export const extractGifUrls = (text: string) => text.match(/(https?:\/\/[^\s]+\.gif)/g) || [];
export const removeGifUrls = (text: string) => text.replace(/https?:\/\/[^\s]+\.gif/g, '').trim();

export function timeAgo(dateStr: string): string {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7); if (w < 4) return `${w}w ago`;
  const mo = Math.floor(d / 30); if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

export interface FeedPostUser { _id: string; username?: string; avatar_url?: string | null }
export interface FeedPostType { _id: string; userId: FeedPostUser; content: string; likesCount: number; isLikedByCurrentUser: boolean; createdAt: string }
export interface FeedComment { _id: string; userId: { _id: string; username?: string; avatar_url?: string | null }; postId: string; content: string; parentId?: string; likesCount: number; isLikedByCurrentUser: boolean; createdAt: string }
interface ClosedTrade { id: string; spotify_id: string; artist_name: string; position_type: 'long' | 'short'; contracts: number; entry_price: number; current_price: number; total_cost: number; unrealized_pnl: number }
interface OpenPosition { id: string; spotify_id: string; artist_name: string; position_type: 'long' | 'short'; contracts: number; entry_price: number; current_price: number; total_cost: number; unrealized_pnl: number }

// ─── BetSlipCard ──────────────────────────────────────────────────────────────

export function BetSlipCard({ trade }: { trade: TradeEmbed }) {
  const isLong = trade.s === 'long';
  const isWin = trade.p >= 0;
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
        {isWin ? '+' : '-'}${Math.abs(trade.p).toFixed(2)}
        <Text style={betSlipStyles.pnlPct}> ({isWin ? '+' : '-'}{Math.abs(trade.pc).toFixed(2)}%)</Text>
      </Text>
      <Text style={betSlipStyles.label}>{trade.o ? 'Open Position' : 'Closed Trade'}</Text>
    </View>
  );
}

// ─── GifImage ─────────────────────────────────────────────────────────────────

export function GifImage({ uri }: { uri: string }) {
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  return (
    <View style={{ borderRadius: 6, overflow: 'hidden', marginTop: 8 }}>
      <ExpoImage
        source={{ uri }}
        style={{ width: '100%', aspectRatio }}
        contentFit="fill"
        onLoad={(e) => {
          if (e.source.width && e.source.height) setAspectRatio(e.source.width / e.source.height);
        }}
      />
    </View>
  );
}

// ─── GifPickerModal ───────────────────────────────────────────────────────────

export function GifPickerModal({ visible, onClose, onSelect }: { visible: boolean; onClose: () => void; onSelect: (url: string) => void }) {
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
      <Pressable style={pickerStyles.overlay} onPress={onClose}>
        <Pressable style={pickerStyles.sheet} onStartShouldSetResponder={() => true}>
          <View style={pickerStyles.handle} />
          <View style={pickerStyles.header}>
            <Text style={pickerStyles.title}>Search GIFs</Text>
            <TouchableOpacity onPress={onClose}><XIcon size={18} color="#7a7a7a" /></TouchableOpacity>
          </View>
          <View style={pickerStyles.searchRow}>
            <TextInput
              style={pickerStyles.searchInput}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={search}
              placeholder="Search GIFs..."
              placeholderTextColor="#7a7a7a"
              returnKeyType="search"
            />
            <TouchableOpacity style={pickerStyles.searchBtn} onPress={search}>
              <Text style={pickerStyles.searchBtnText}>Search</Text>
            </TouchableOpacity>
          </View>
          {loading ? <GlyphDrawLoader width={24} /> : (
            <FlatList
              showsVerticalScrollIndicator={false}
              data={results}
              numColumns={2}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={pickerStyles.gifItem} onPress={() => { onSelect(item.images.fixed_height.url); onClose(); }}>
                  <Image source={{ uri: item.images.fixed_height_small.url }} style={pickerStyles.gifImage} />
                </TouchableOpacity>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── TradePickerModal ─────────────────────────────────────────────────────────

export function TradePickerModal({ visible, onClose, onSelect, token }: { visible: boolean; onClose: () => void; onSelect: (t: TradeEmbed) => void; token: string | null }) {
  const [trades, setTrades] = useState<ClosedTrade[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !token) return;
    setLoading(true);
    fetch(ENDPOINTS.TRADES.HISTORY, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setTrades(d.history || [])).catch(() => {}).finally(() => setLoading(false));
  }, [visible, token]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={pickerStyles.overlay} onPress={onClose}>
        <Pressable style={pickerStyles.sheet} onStartShouldSetResponder={() => true}>
          <View style={pickerStyles.handle} />
          <View style={pickerStyles.header}>
            <Text style={pickerStyles.title}>Share a Closed Trade</Text>
            <TouchableOpacity onPress={onClose}><XIcon size={18} color="#7a7a7a" /></TouchableOpacity>
          </View>
          {loading ? <GlyphDrawLoader width={24} /> :
            trades.length === 0 ? <Text style={pickerStyles.empty}>No closed trades found.</Text> : (
              <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                {trades.map(t => {
                  const isLong = t.position_type === 'long';
                  const isWin = t.unrealized_pnl >= 0;
                  const pc = t.total_cost > 0 ? (t.unrealized_pnl / t.total_cost) * 100 : 0;
                  return (
                    <TouchableOpacity key={t.id} style={pickerStyles.row} activeOpacity={0.7}
                      onPress={() => { onSelect({ a: t.spotify_id, n: t.artist_name, s: t.position_type, c: t.contracts, e: t.entry_price, x: t.current_price, p: t.unrealized_pnl, pc }); onClose(); }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Text style={pickerStyles.rowArtist}>{t.artist_name}</Text>
                          <View style={[betSlipStyles.badge, isLong ? betSlipStyles.badgeLong : betSlipStyles.badgeShort]}>
                            <Text style={[betSlipStyles.badgeText, { color: isLong ? POSITIVE : NEGATIVE }]}>{t.position_type.toUpperCase()}</Text>
                          </View>
                        </View>
                        <Text style={pickerStyles.rowSub}>${(t.entry_price ?? 0).toFixed(2)} → ${(t.current_price ?? 0).toFixed(2)} · {t.contracts} contracts</Text>
                      </View>
                      <Text style={[pickerStyles.rowPnl, { color: isWin ? POSITIVE : NEGATIVE }]}>
                        {isWin ? '+' : '-'}${Math.abs(t.unrealized_pnl ?? 0).toFixed(2)}
                        {'\n'}<Text style={pickerStyles.rowPct}>({isWin ? '+' : '-'}{Math.abs(pc).toFixed(1)}%)</Text>
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

// ─── PositionPickerModal ──────────────────────────────────────────────────────

export function PositionPickerModal({ visible, onClose, onSelect, token }: { visible: boolean; onClose: () => void; onSelect: (t: TradeEmbed) => void; token: string | null }) {
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !token) return;
    setLoading(true);
    fetch(ENDPOINTS.TRADES.ALL_POSITIONS, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setPositions(d.trades || [])).catch(() => {}).finally(() => setLoading(false));
  }, [visible, token]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={pickerStyles.overlay} onPress={onClose}>
        <Pressable style={pickerStyles.sheet} onStartShouldSetResponder={() => true}>
          <View style={pickerStyles.handle} />
          <View style={pickerStyles.header}>
            <Text style={pickerStyles.title}>Share an Open Position</Text>
            <TouchableOpacity onPress={onClose}><XIcon size={18} color="#7a7a7a" /></TouchableOpacity>
          </View>
          {loading ? <GlyphDrawLoader width={24} /> :
            positions.length === 0 ? <Text style={pickerStyles.empty}>No open positions found.</Text> : (
              <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                {positions.map(pos => {
                  const isLong = pos.position_type === 'long';
                  const pnl = pos.unrealized_pnl ?? 0;
                  const isWin = pnl >= 0;
                  const pc = pos.total_cost > 0 ? (pnl / pos.total_cost) * 100 : 0;
                  return (
                    <TouchableOpacity key={pos.id} style={pickerStyles.row} activeOpacity={0.7}
                      onPress={() => { onSelect({ a: pos.spotify_id, n: pos.artist_name, s: pos.position_type, c: pos.contracts, e: pos.entry_price, x: pos.current_price ?? pos.entry_price, p: pnl, pc, o: true }); onClose(); }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Text style={pickerStyles.rowArtist}>{pos.artist_name}</Text>
                          <View style={[betSlipStyles.badge, isLong ? betSlipStyles.badgeLong : betSlipStyles.badgeShort]}>
                            <Text style={[betSlipStyles.badgeText, { color: isLong ? POSITIVE : NEGATIVE }]}>{pos.position_type.toUpperCase()}</Text>
                          </View>
                        </View>
                        <Text style={pickerStyles.rowSub}>Entry ${pos.entry_price.toFixed(2)} · {pos.contracts} contracts</Text>
                      </View>
                      <Text style={[pickerStyles.rowPnl, { color: isWin ? POSITIVE : NEGATIVE }]}>
                        {isWin ? '+' : '-'}${Math.abs(pnl).toFixed(2)}
                        {'\n'}<Text style={pickerStyles.rowPct}>({isWin ? '+' : '-'}{Math.abs(pc).toFixed(1)}%)</Text>
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

// ─── FeedCommentRow ───────────────────────────────────────────────────────────

export function FeedCommentRow({ comment, likeState, currentUserId, token, onLike, onDelete, onReply, isReply, parentUsername, rowStyle }: {
  comment: FeedComment;
  likeState: { liked: boolean; count: number };
  currentUserId?: string;
  token: string | null;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onReply: ((comment: FeedComment) => void) | (() => void);
  isReply?: boolean;
  parentUsername?: string;
  rowStyle?: object;
}) {
  const { trade: ct, text: ct2 } = parseTrade(comment.content);
  const cgifs = extractGifUrls(ct2);
  const ctext = removeGifUrls(ct2);
  const cname = comment.userId?.username || 'Anonymous';
  const isOwner = currentUserId && comment.userId?._id === currentUserId;
  const { animatedStyle, triggerDelete } = useDeleteAnimation(() => onDelete(comment._id));

  return (
    <Animated.View style={[commentModalStyles.commentRow, rowStyle, animatedStyle]}>
      <View style={[commentModalStyles.commentAvatar, isReply && { width: 36, height: 36, borderRadius: 18 }]}>
        {comment.userId?.avatar_url
          ? <ExpoImage source={{ uri: comment.userId.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" />
          : <Text style={commentModalStyles.commentAvatarText}>{cname.charAt(0).toUpperCase()}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <View style={commentModalStyles.commentBubble}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <Text style={commentModalStyles.commentName}>{cname}</Text>
            <VerifiedBadge />
            <OGBadge />
            {parentUsername && (
              <Text style={commentModalStyles.replyArrow}>→ <Text style={{ color: '#fff' }}>@{parentUsername}</Text></Text>
            )}
            <Text style={commentModalStyles.commentTime}>{timeAgo(comment.createdAt)}</Text>
          </View>
          {ctext ? <ReadMoreText text={ctext} style={commentModalStyles.commentText} /> : null}
          {cgifs.map((url, i) => <GifImage key={i} uri={url} />)}
          {ct && <BetSlipCard trade={ct} />}
        </View>
        <View style={commentModalStyles.commentActions}>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }} onPress={() => onLike(comment._id)} disabled={!token}>
            <HeartIcon size={16} color={likeState.liked ? NEGATIVE : '#7a7a7a'} filled={likeState.liked} />
            {likeState.count > 0 && <Text style={[commentModalStyles.likeCount, likeState.liked && { color: NEGATIVE }]}>{likeState.count}</Text>}
          </TouchableOpacity>
          {token && (
            <TouchableOpacity onPress={() => onReply(comment)}>
              <MessageCircleIcon size={15} color="#7a7a7a" />
            </TouchableOpacity>
          )}
          {isOwner && (
            <TouchableOpacity onPress={triggerDelete}>
              <Trash2Icon size={15} color="#7a7a7a" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

// ─── FeedCommentModal ─────────────────────────────────────────────────────────

export function FeedCommentModal({ post, onClose, token, currentUserId }: {
  post: FeedPostType; onClose: () => void; token: string | null; currentUserId?: string;
}) {
  const router = useRouter();
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [selectedGif, setSelectedGif] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<TradeEmbed | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showTradePicker, setShowTradePicker] = useState(false);
  const [showPositionPicker, setShowPositionPicker] = useState(false);
  const [likeStates, setLikeStates] = useState<Record<string, { liked: boolean; count: number }>>({});
  const [replyingTo, setReplyingTo] = useState<FeedComment | null>(null);
  const [undoComment, setUndoComment] = useState<{ id: string; data: FeedComment; index: number } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDeleteRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (pendingDeleteRef.current) {
        fetch(ENDPOINTS.FEED_COMMENTS.DELETE(pendingDeleteRef.current), {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).catch(() => {});
      }
    };
  }, []);

  const { trade: postTrade, text: postText } = parseTrade(post.content);
  const postGifs = extractGifUrls(postText);
  const postContent = removeGifUrls(postText);
  const displayName = post.userId?.username || 'Anonymous';

  useEffect(() => {
    fetch(ENDPOINTS.FEED_COMMENTS.LIST(post._id), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => {
        const fetched: FeedComment[] = d.comments || [];
        setComments(fetched);
        const map: Record<string, { liked: boolean; count: number }> = {};
        fetched.forEach(c => { map[c._id] = { liked: c.isLikedByCurrentUser, count: c.likesCount }; });
        setLikeStates(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [post._id, token]);

  const handlePost = async () => {
    if (!content.trim() && !selectedGif && !selectedTrade) return;
    let combined = content.trim();
    if (selectedGif) combined = combined ? `${combined}\n${selectedGif}` : selectedGif;
    if (selectedTrade) combined = combined ? `${combined}\n[[TRADE:${JSON.stringify(selectedTrade)}]]` : `[[TRADE:${JSON.stringify(selectedTrade)}]]`;
    setSubmitting(true);
    try {
      const body: any = { postId: post._id, content: combined };
      if (replyingTo) body.parentId = replyingTo._id;
      const res = await fetch(ENDPOINTS.FEED_COMMENTS.CREATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success && data.comment) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setComments(prev => [...prev, data.comment]);
        setLikeStates(prev => ({ ...prev, [data.comment._id]: { liked: false, count: 0 } }));
        setContent('');
        setSelectedGif(null);
        setSelectedTrade(null);
        setReplyingTo(null);
      }
    } catch { } finally { setSubmitting(false); }
  };

  const handleLike = async (commentId: string) => {
    if (!token) return;
    const current = likeStates[commentId] || { liked: false, count: 0 };
    setLikeStates(prev => ({ ...prev, [commentId]: { liked: !current.liked, count: current.liked ? current.count - 1 : current.count + 1 } }));
    try {
      await fetch(ENDPOINTS.FEED_COMMENTS.LIKE(commentId), {
        method: current.liked ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      setLikeStates(prev => ({ ...prev, [commentId]: current }));
    }
  };

  const handleDelete = (commentId: string) => {
    setComments(prev => {
      const index = prev.findIndex(c => c._id === commentId);
      const comment = prev[index];
      if (!comment) return prev;
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      pendingDeleteRef.current = commentId;
      setUndoComment({ id: commentId, data: comment, index });
      undoTimerRef.current = setTimeout(async () => {
        try {
          await fetch(ENDPOINTS.FEED_COMMENTS.DELETE(commentId), {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch { }
        pendingDeleteRef.current = null;
        setUndoComment(null);
      }, 4000);
      return prev.filter(c => c._id !== commentId);
    });
  };

  const handleUndoDelete = () => {
    if (!undoComment) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    pendingDeleteRef.current = null;
    setComments(prev => {
      const next = [...prev];
      next.splice(undoComment.index, 0, undoComment.data);
      return next;
    });
    setUndoComment(null);
  };

  const topLevel = comments.filter(c => !c.parentId);
  const getReplies = (parentId: string) => comments.filter(c => c.parentId === parentId);

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={{ flex: 1, position: 'relative' }}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.dark.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={commentModalStyles.header}>
            <TouchableOpacity onPress={onClose} style={commentModalStyles.backBtn}>
              <ArrowLeftIcon size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={commentModalStyles.headerTitle}>Comments</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }}>
            <View style={commentModalStyles.postPreview}>
              <View style={commentModalStyles.avatar}>
                {post.userId?.avatar_url
                  ? <ExpoImage source={{ uri: post.userId.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" />
                  : <Text style={commentModalStyles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Text style={commentModalStyles.postUsername}>{displayName}</Text>
                  <VerifiedBadge />
                  <OGBadge />
                  <Text style={commentModalStyles.postTime}>{timeAgo(post.createdAt)}</Text>
                </View>
                {postContent ? <Text style={commentModalStyles.postContent}>{postContent}</Text> : null}
                {postGifs.map((url, i) => <GifImage key={i} uri={url} />)}
                {postTrade && <BetSlipCard trade={postTrade} />}
              </View>
            </View>

            <View style={commentModalStyles.divider} />

            {loading ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <GlyphDrawLoader width={24} />
              </View>
            ) : topLevel.length === 0 ? (
              <Text style={commentModalStyles.noComments}>No comments yet. Be the first!</Text>
            ) : (
              topLevel.map(comment => (
                <View key={comment._id}>
                  <FeedCommentRow
                    comment={comment}
                    likeState={likeStates[comment._id] || { liked: comment.isLikedByCurrentUser, count: comment.likesCount }}
                    currentUserId={currentUserId}
                    token={token}
                    onLike={handleLike}
                    onDelete={handleDelete}
                    onReply={setReplyingTo}
                  />
                  {getReplies(comment._id).map(reply => (
                    <View key={reply._id} style={commentModalStyles.repliesIndent}>
                      <FeedCommentRow
                        comment={reply}
                        likeState={likeStates[reply._id] || { liked: reply.isLikedByCurrentUser, count: reply.likesCount }}
                        currentUserId={currentUserId}
                        token={token}
                        onLike={handleLike}
                        onDelete={handleDelete}
                        onReply={setReplyingTo}
                        isReply
                        parentUsername={comment.userId?.username || 'Anonymous'}
                      />
                    </View>
                  ))}
                </View>
              ))
            )}
          </ScrollView>

          {token && (
            <View style={commentModalStyles.inputBar}>
              {replyingTo && (
                <View style={commentModalStyles.replyBanner}>
                  <Text style={commentModalStyles.replyBannerText}>
                    Replying to <Text style={{ color: '#fff' }}>@{replyingTo.userId?.username || 'Anonymous'}</Text>
                  </Text>
                  <TouchableOpacity onPress={() => setReplyingTo(null)}>
                    <XIcon size={14} color="#7a7a7a" />
                  </TouchableOpacity>
                </View>
              )}
              {(selectedGif || selectedTrade) && (
                <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
                  {selectedGif && <GifImage uri={selectedGif} />}
                  {selectedTrade && <BetSlipCard trade={selectedTrade} />}
                </View>
              )}
              <View style={commentModalStyles.toolbarRow}>
                {selectedGif ? (
                  <TouchableOpacity onPress={() => setSelectedGif(null)}>
                    <Text style={commentModalStyles.toolbarBtn}>Delete GIF</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setShowGifPicker(true)}>
                    <Text style={commentModalStyles.toolbarBtn}>GIF</Text>
                  </TouchableOpacity>
                )}
                {selectedTrade ? (
                  <TouchableOpacity onPress={() => setSelectedTrade(null)}>
                    <Text style={commentModalStyles.toolbarBtn}>Remove {selectedTrade.o ? 'Position' : 'Trade'}</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity onPress={() => setShowTradePicker(true)}>
                      <Text style={commentModalStyles.toolbarBtn}>Trade</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowPositionPicker(true)}>
                      <Text style={commentModalStyles.toolbarBtn}>Position</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
              <View style={commentModalStyles.inputRow}>
                {token ? (
                  <View style={commentModalStyles.inputPill}>
                    <TextInput
                      style={commentModalStyles.input}
                      value={content}
                      onChangeText={setContent}
                      placeholder={replyingTo ? `Reply to @${replyingTo.userId?.username || 'Anonymous'}...` : 'Add a comment...'}
                      placeholderTextColor="#7a7a7a"
                      maxLength={500}
                    />
                    <TouchableOpacity
                      style={[commentModalStyles.sendBtn, (!content.trim() && !selectedGif && !selectedTrade) && { opacity: 0.4 }]}
                      onPress={handlePost}
                      disabled={submitting || (!content.trim() && !selectedGif && !selectedTrade)}
                    >
                      <Text style={commentModalStyles.sendBtnText}>{submitting ? '...' : replyingTo ? 'Reply' : 'Post'}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  // guests: comments stay readable; the composer becomes a sign-in CTA
                  <TouchableOpacity
                    style={commentModalStyles.inputPill}
                    onPress={() => { onClose(); router.push('/welcome?back=1'); }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#7a7a7a', fontSize: 15, paddingVertical: 10 }}>Sign in to comment</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
        <GifPickerModal visible={showGifPicker} onClose={() => setShowGifPicker(false)} onSelect={setSelectedGif} />
        <TradePickerModal visible={showTradePicker} onClose={() => setShowTradePicker(false)} onSelect={setSelectedTrade} token={token} />
        <PositionPickerModal visible={showPositionPicker} onClose={() => setShowPositionPicker(false)} onSelect={setSelectedTrade} token={token} />
        <UndoToast visible={!!undoComment} message="Comment deleted" onUndo={handleUndoDelete} bottom={136} />
      </View>
    </Modal>
  );
}

// ─── FeedPostItem ─────────────────────────────────────────────────────────────

export function FeedPostItem({ post, currentUserId, token, onDelete, isNew, onRequireAuth }: {
  post: FeedPostType; currentUserId?: string; token: string | null; onDelete: (id: string) => void; isNew?: boolean;
  onRequireAuth?: () => void; // guest tapped an auth-only action (like) → show the sign-in prompt
}) {
  const router = useRouter();
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [isLiked, setIsLiked] = useState(post.isLikedByCurrentUser || false);
  const [liking, setLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const { animatedStyle, triggerDelete } = useDeleteAnimation(() => onDelete(post._id));

  const appearOpacity = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  const appearTranslateY = useRef(new Animated.Value(isNew ? 28 : 0)).current;
  useEffect(() => {
    if (isNew) {
      Animated.parallel([
        Animated.timing(appearOpacity, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(appearTranslateY, { toValue: 0, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    }
  }, []);

  const [undoPreview, setUndoPreview] = useState<{ id: string; data: FeedComment; index: number } | null>(null);
  const undoPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [commentPreview, setCommentPreview] = useState<FeedComment[]>([]);
  const [totalComments, setTotalComments] = useState(0);
  const [previewLikeStates, setPreviewLikeStates] = useState<Record<string, { liked: boolean; count: number }>>({});

  const displayName = post.userId?.username || 'Anonymous';
  const { trade, text: contentWithoutTrade } = parseTrade(post.content);
  const gifUrls = extractGifUrls(contentWithoutTrade);
  const textContent = removeGifUrls(contentWithoutTrade);
  const isOwner = currentUserId && post.userId?._id === currentUserId;

  const fetchPreview = useCallback(async () => {
    try {
      const res = await fetch(ENDPOINTS.FEED_COMMENTS.LIST(post._id), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      const all: FeedComment[] = data.comments || [];
      const topLevel = all.filter(c => !c.parentId);
      setTotalComments(all.length);
      setCommentPreview(topLevel.slice(0, 3));
      const map: Record<string, { liked: boolean; count: number }> = {};
      topLevel.slice(0, 3).forEach(c => { map[c._id] = { liked: c.isLikedByCurrentUser, count: c.likesCount }; });
      setPreviewLikeStates(map);
    } catch {}
  }, [post._id, token]);

  useEffect(() => { fetchPreview(); }, []);

  const handleLike = async () => {
    if (!token || liking) return;
    setLiking(true);
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikesCount(c => wasLiked ? c - 1 : c + 1);
    try {
      const res = await fetch(ENDPOINTS.FEED.LIKE(post._id), {
        method: wasLiked ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) { setIsLiked(!wasLiked); setLikesCount(data.likes); }
      else { setIsLiked(wasLiked); setLikesCount(c => wasLiked ? c + 1 : c - 1); }
    } catch {
      setIsLiked(wasLiked);
      setLikesCount(c => wasLiked ? c + 1 : c - 1);
    } finally { setLiking(false); }
  };

  const openComments = () => setShowComments(true);
  const closeComments = () => { setShowComments(false); fetchPreview(); };

  const handlePreviewLike = async (commentId: string) => {
    if (!token) return;
    const current = previewLikeStates[commentId] || { liked: false, count: 0 };
    setPreviewLikeStates(prev => ({ ...prev, [commentId]: { liked: !current.liked, count: current.liked ? current.count - 1 : current.count + 1 } }));
    try {
      await fetch(ENDPOINTS.FEED_COMMENTS.LIKE(commentId), {
        method: current.liked ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      setPreviewLikeStates(prev => ({ ...prev, [commentId]: current }));
    }
  };

  const handlePreviewDelete = (commentId: string) => {
    setCommentPreview(prev => {
      const index = prev.findIndex(c => c._id === commentId);
      const comment = prev[index];
      if (!comment) return prev;
      if (undoPreviewTimerRef.current) clearTimeout(undoPreviewTimerRef.current);
      setUndoPreview({ id: commentId, data: comment, index });
      setTotalComments(n => Math.max(0, n - 1));
      undoPreviewTimerRef.current = setTimeout(async () => {
        try {
          await fetch(ENDPOINTS.FEED_COMMENTS.DELETE(commentId), {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {}
        setUndoPreview(null);
      }, 4000);
      return prev.filter(c => c._id !== commentId);
    });
  };

  const handleUndoPreviewDelete = () => {
    if (!undoPreview) return;
    if (undoPreviewTimerRef.current) clearTimeout(undoPreviewTimerRef.current);
    setCommentPreview(prev => {
      const next = [...prev];
      next.splice(undoPreview.index, 0, undoPreview.data);
      return next;
    });
    setTotalComments(n => n + 1);
    setUndoPreview(null);
  };

  return (
    <Animated.View style={{ opacity: appearOpacity, transform: [{ translateY: appearTranslateY }] }}>
      <Animated.View style={[postStyles.container, animatedStyle, { position: 'relative' }]}>
        <TouchableOpacity activeOpacity={0.85} onPress={openComments}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={postStyles.avatar}>
              {post.userId?.avatar_url
                ? <ExpoImage source={{ uri: post.userId.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" />
                : <Text style={postStyles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={postStyles.username}>{displayName}</Text>
                  <VerifiedBadge />
                  <OGBadge />
                  <Text style={postStyles.time}>{timeAgo(post.createdAt)}</Text>
                </View>
                {trade && (
                  <TouchableOpacity onPress={() => router.push(`/artist/${encodeURIComponent(trade.a)}` as any)}>
                    <Text style={postStyles.tradeBtnText}>Trade</Text>
                  </TouchableOpacity>
                )}
              </View>
              {textContent ? <ReadMoreText text={textContent} style={postStyles.content} /> : null}
              {gifUrls.map((url, i) => <GifImage key={i} uri={url} />)}
              {trade && <BetSlipCard trade={trade} />}
            </View>
          </View>
        </TouchableOpacity>

        <View style={[postStyles.actions, { paddingLeft: 56 }]}>
          <TouchableOpacity style={postStyles.actionBtn} onPress={token ? handleLike : onRequireAuth} disabled={!token && !onRequireAuth}>
            <HeartIcon size={18} color={isLiked ? NEGATIVE : '#7a7a7a'} filled={isLiked} />
            {likesCount > 0 && <Text style={[postStyles.actionCount, isLiked && { color: NEGATIVE }]}>{likesCount}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={postStyles.actionBtn} onPress={openComments}>
            <MessageCircleIcon size={16} color="#7a7a7a" />
          </TouchableOpacity>
          {isOwner && (
            <TouchableOpacity style={postStyles.actionBtn} onPress={triggerDelete}>
              <Trash2Icon size={16} color="#7a7a7a" />
            </TouchableOpacity>
          )}
        </View>

        {totalComments > 0 && (
          <View style={postStyles.commentPreviewWrap}>
            {totalComments > 3 && (
              <TouchableOpacity onPress={openComments} style={{ marginTop: 6, marginBottom: 4 }}>
                <Text style={postStyles.viewAllComments}>View all {totalComments} comments</Text>
              </TouchableOpacity>
            )}
            {commentPreview.map(c => (
              <FeedCommentRow
                key={c._id}
                comment={c}
                likeState={previewLikeStates[c._id] || { liked: c.isLikedByCurrentUser, count: c.likesCount }}
                currentUserId={currentUserId}
                token={token}
                onLike={handlePreviewLike}
                onDelete={handlePreviewDelete}
                onReply={openComments}
                rowStyle={{ paddingHorizontal: 0 }}
              />
            ))}
          </View>
        )}

        {showComments && (
          <FeedCommentModal post={post} onClose={closeComments} token={token} currentUserId={currentUserId} />
        )}
        <UndoToast visible={!!undoPreview} message="Comment deleted" onUndo={handleUndoPreviewDelete} bottom={8} />
      </Animated.View>
    </Animated.View>
  );
}

// ─── FeedPostForm ─────────────────────────────────────────────────────────────

export function FeedPostForm({ onPostAdded, token, user }: {
  onPostAdded: () => void; token: string | null; user: { id?: string; username?: string; avatar_url?: string | null } | null;
}) {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [selectedGif, setSelectedGif] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<TradeEmbed | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showTradePicker, setShowTradePicker] = useState(false);
  const [showPositionPicker, setShowPositionPicker] = useState(false);

  const displayName = user?.username || '';

  // guests: the composer becomes a sign-in CTA (feed itself stays readable)
  if (!token) {
    return (
      <TouchableOpacity
        style={{ marginHorizontal: 16, marginVertical: 12, backgroundColor: '#18181b', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 18 }}
        onPress={() => router.push('/welcome?back=1')}
        activeOpacity={0.8}
      >
        <Text style={{ color: '#7a7a7a', fontSize: 15 }}>Sign in to join the conversation…</Text>
      </TouchableOpacity>
    );
  }

  const handlePost = async () => {
    if (submitting || (!content.trim() && !selectedGif && !selectedTrade)) return;
    let combined = content.trim();
    if (selectedGif) combined = combined ? `${combined}\n${selectedGif}` : selectedGif;
    if (selectedTrade) combined = combined ? `${combined}\n[[TRADE:${JSON.stringify(selectedTrade)}]]` : `[[TRADE:${JSON.stringify(selectedTrade)}]]`;
    Keyboard.dismiss();
    setContent('');
    setSelectedGif(null);
    setSelectedTrade(null);
    setSubmitting(true);
    try {
      const res = await fetch(ENDPOINTS.FEED.CREATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: combined }),
      });
      const data = await res.json();
      if (data.success) onPostAdded();
    } catch { } finally { setSubmitting(false); }
  };

  if (!token) return null;

  return (
    <View style={formStyles.container}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={formStyles.avatar}>
          {user?.avatar_url
            ? <ExpoImage source={{ uri: user.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" />
            : <Text style={formStyles.avatarText}>{displayName ? displayName.charAt(0).toUpperCase() : '?'}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <TextInput
            style={formStyles.input}
            value={content}
            onChangeText={setContent}
            placeholder="What's your prediction?"
            placeholderTextColor="#7a7a7a"
            multiline
            maxLength={2000}
          />
          {selectedGif && <View style={{ marginTop: 8 }}><GifImage uri={selectedGif} /></View>}
          {selectedTrade && <BetSlipCard trade={selectedTrade} />}
        </View>
      </View>
      <View style={formStyles.toolbar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          {selectedGif ? (
            <TouchableOpacity onPress={() => setSelectedGif(null)}>
              <Text style={formStyles.toolBtn}>Delete GIF</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setShowGifPicker(true)}>
              <Text style={formStyles.toolBtn}>GIF</Text>
            </TouchableOpacity>
          )}
          {selectedTrade ? (
            <TouchableOpacity onPress={() => setSelectedTrade(null)}>
              <Text style={formStyles.toolBtn}>Remove {selectedTrade.o ? 'Position' : 'Trade'}</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity onPress={() => setShowTradePicker(true)}>
                <Text style={formStyles.toolBtn}>Trade</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowPositionPicker(true)}>
                <Text style={formStyles.toolBtn}>Position</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={formStyles.charCount}>{2000 - content.length} left</Text>
          <TouchableOpacity
            style={[formStyles.postBtn, (!content.trim() && !selectedGif && !selectedTrade) && { opacity: 0.4 }]}
            onPress={handlePost}
            disabled={submitting || (!content.trim() && !selectedGif && !selectedTrade)}
          >
            <Text style={formStyles.postBtnText}>{submitting ? '...' : 'Post'}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <GifPickerModal visible={showGifPicker} onClose={() => setShowGifPicker(false)} onSelect={setSelectedGif} />
      <TradePickerModal visible={showTradePicker} onClose={() => setShowTradePicker(false)} onSelect={setSelectedTrade} token={token} />
      <PositionPickerModal visible={showPositionPicker} onClose={() => setShowPositionPicker(false)} onSelect={setSelectedTrade} token={token} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

export const screenStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  separator: { height: 1, backgroundColor: '#1c1c1e' },
  empty: { color: '#71717a', fontSize: 14, textAlign: 'center', marginTop: 40 },
  fab: {
    position: 'absolute',
    bottom: 10, right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  fabIcon: { color: '#000', fontSize: 28, lineHeight: 30, fontWeight: '300' },
  modalSheet: { flex: 1, backgroundColor: Colors.dark.background, paddingTop: Platform.OS === 'ios' ? 56 : 16 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#1c1c1e',
  },
  modalCancel: { color: '#7a7a7a', fontSize: 15 },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

const formStyles = StyleSheet.create({
  container: { borderBottomWidth: 1, borderBottomColor: '#1c1c1e', padding: 16, paddingTop: 16, paddingBottom: 12, marginTop: -3 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { color: '#111', fontWeight: '700', fontSize: 16 },
  input: { color: '#fff', fontSize: 14, minHeight: 40, paddingTop: 12, paddingBottom: 0, textAlignVertical: 'top' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingLeft: 52 },
  toolBtn: { color: '#7a7a7a', fontSize: 12, fontWeight: '600' },
  charCount: { color: '#7a7a7a', fontSize: 12 },
  postBtn: { backgroundColor: '#fff', borderRadius: 99, paddingHorizontal: 22, paddingVertical: 11, minWidth: 72, alignItems: 'center' },
  postBtnText: { color: '#000', fontSize: 13, fontWeight: '500' },
});

const postStyles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 16 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { color: '#111', fontWeight: '700', fontSize: 17 },
  username: { color: '#fff', fontSize: 13, fontWeight: '600' },
  time: { color: '#7a7a7a', fontSize: 11 },
  content: { color: '#fff', fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { color: '#7a7a7a', fontSize: 12, fontWeight: '500' },
  tradeBtnText: { color: '#7a7a7a', fontSize: 12, fontWeight: '600' },
  commentPreviewWrap: { paddingTop: 4, paddingLeft: 56 },
  viewAllComments: { color: '#7a7a7a', fontSize: 13 },
});

const commentModalStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#262626',
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  postPreview: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { color: '#111', fontWeight: '700', fontSize: 16 },
  postUsername: { color: '#fff', fontSize: 13, fontWeight: '600' },
  postTime: { color: '#7a7a7a', fontSize: 11 },
  postContent: { color: '#fff', fontSize: 13, lineHeight: 19 },
  divider: { height: 1, backgroundColor: '#1c1c1e' },
  noComments: { color: '#71717a', fontSize: 14, textAlign: 'center', marginTop: 32 },
  commentRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
  commentAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  commentAvatarText: { color: '#111', fontWeight: '700', fontSize: 14 },
  commentBubble: { backgroundColor: '#111111', borderRadius: 8, borderWidth: 1, borderColor: '#222222', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, flex: 1 },
  commentName: { color: '#fff', fontSize: 12, fontWeight: '600' },
  commentTime: { color: '#7a7a7a', fontSize: 10 },
  commentText: { color: '#fff', fontSize: 13, lineHeight: 18 },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8, marginLeft: 4 },
  likeCount: { color: '#7a7a7a', fontSize: 11, fontWeight: '500' },
  inputBar: { borderTopWidth: 1, borderTopColor: '#262626', paddingBottom: Platform.OS === 'ios' ? 28 : 8 },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 12, paddingTop: 8 },
  toolbarBtn: { color: '#7a7a7a', fontSize: 12, fontWeight: '600' },
  inputRow: { paddingHorizontal: 12, paddingVertical: 10 },
  inputPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 99, paddingLeft: 16, paddingRight: 10, paddingVertical: 6 },
  input: { flex: 1, color: '#fff', fontSize: 14, height: 36, paddingVertical: 0, textAlignVertical: 'center' },
  sendBtn: { backgroundColor: '#fff', borderRadius: 99, paddingHorizontal: 16, paddingVertical: 8, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendBtnText: { color: '#000', fontSize: 13, fontWeight: '500' },
  repliesIndent: { marginLeft: 48 },
  replyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 8 },
  replyBannerText: { color: '#7a7a7a', fontSize: 12 },
  replyArrow: { color: '#7a7a7a', fontSize: 13 },
});

const betSlipStyles = StyleSheet.create({
  card: { marginTop: 8, borderRadius: 10, borderWidth: 1, borderColor: '#222222', backgroundColor: '#111111', padding: 12, maxWidth: 260 },
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

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.dark.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 32 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#3f3f46', alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { color: '#fff', fontSize: 15, fontWeight: '600' },
  empty: { color: '#71717a', fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, backgroundColor: '#171717', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: '#fff', fontSize: 14 },
  searchBtn: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'center' },
  searchBtnText: { color: '#000', fontSize: 13, fontWeight: '500' },
  gifItem: { flex: 1, margin: 4 },
  gifImage: { width: '100%', height: 100, borderRadius: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  rowArtist: { color: '#fff', fontSize: 13, fontWeight: '600' },
  rowSub: { color: '#71717a', fontSize: 12 },
  rowPnl: { fontSize: 13, fontWeight: '600', textAlign: 'right' },
  rowPct: { fontSize: 11, fontWeight: '400' },
});
