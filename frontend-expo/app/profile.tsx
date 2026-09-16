import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  StatusBar, ScrollView, KeyboardAvoidingView, Platform, Pressable, Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '@/context/AuthContext';
import { ENDPOINTS, API_URL } from '@/constants/API';
import { GlyphDrawLoader } from '@/components/GlyphDrawLoader';
import { SignInHero } from '@/components/SignInHero';
import { Colors } from '@/constants/theme';
import { POSITIVE, NEGATIVE } from '@/constants/colors';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Position {
  id: string;
  artist_name: string;
  position_type: 'long' | 'short';
  contracts: number;
  entry_price: number;
  current_price: number;
  total_cost: number;
  unrealized_pnl: number;
  opened_at: string;
}

interface ClosedTrade {
  id: string;
  artist_name: string;
  position_type: 'long' | 'short';
  contracts: number;
  entry_price: number;
  total_cost: number;
  unrealized_pnl: number;
  opened_at: string;
  closed_at: string;
  status: 'closed' | 'liquidated';
}

interface Post {
  _id: string;
  userId: { _id: string; username?: string; avatar_url?: string | null };
  content: string;
  likesCount: number;
  isLikedByCurrentUser: boolean;
  createdAt: string;
}

interface FeedComment {
  _id: string;
  userId: { _id: string; username?: string; avatar_url?: string | null };
  content: string;
  parentId?: string;
  likesCount: number;
  isLikedByCurrentUser: boolean;
  createdAt: string;
}

type Tab = 'posts' | 'positions' | 'trades';

// ─── Trade / GIF helpers ──────────────────────────────────────────────────────

const TRADE_REGEX = /\[\[TRADE:(\{.*?\})\]\]/s;
interface TradeEmbed { a: string; s: 'long' | 'short'; c: number; e: number; x: number; p: number; pc: number; o?: boolean }

function parseTrade(content: string): { trade: TradeEmbed | null; text: string } {
  const match = content.match(TRADE_REGEX);
  if (!match) return { trade: null, text: content };
  try { return { trade: JSON.parse(match[1]), text: content.replace(TRADE_REGEX, '').trim() }; }
  catch { return { trade: null, text: content }; }
}

const extractGifUrls = (text: string) => text.match(/(https?:\/\/[^\s]+\.gif)/g) || [];
const removeGifUrls = (text: string) => text.replace(/https?:\/\/[^\s]+\.gif/g, '').trim();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Icons ────────────────────────────────────────────────────────────────────

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

// ─── Profile Screen ───────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [tab, setTab] = useState<Tab>('posts');

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  const [positions, setPositions] = useState<Position[]>([]);
  const [totalVolume, setTotalVolume] = useState(0);
  const [totalPnl, setTotalPnl] = useState(0);
  const [positionsLoading, setPositionsLoading] = useState(false);

  const [trades, setTrades] = useState<ClosedTrade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);

  const userId = (user as any)?.id || (user as any)?._id;
  const username = (user as any)?.username || 'Anonymous';
  const avatarUrl = (user as any)?.avatar_url || null;

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchPosts = useCallback(async () => {
    if (!userId) return;
    setPostsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/feed?user_id=${userId}&limit=50`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) setPosts(data.posts || []);
    } catch {} finally { setPostsLoading(false); }
  }, [userId, token]);

  const fetchPositions = useCallback(async () => {
    setPositionsLoading(true);
    try {
      const [portRes, meRes] = await Promise.all([
        fetch(ENDPOINTS.PORTFOLIO, { headers: authHeaders }),
        fetch(ENDPOINTS.AUTH.ME, { headers: authHeaders }),
      ]);
      const portData = await portRes.json();
      setPositions(portData.positions || []);
      setTotalPnl(portData.total_unrealized_pnl || 0);
      if (meRes.ok) {
        const meData = await meRes.json();
        setTotalVolume(meData.user?.total_volume || 0);
      }
    } catch {} finally { setPositionsLoading(false); }
  }, [token]);

  const fetchTrades = useCallback(async () => {
    setTradesLoading(true);
    try {
      const res = await fetch(ENDPOINTS.TRADES.HISTORY, { headers: authHeaders });
      const data = await res.json();
      setTrades(data.history || []);
    } catch {} finally { setTradesLoading(false); }
  }, [token]);

  useEffect(() => {
    fetchPosts();
    fetchPositions();
    fetchTrades();
  }, []);

  // Guests: this screen's content IS the sign-in screen (rendered inline — no transition or
  // fallback behind it). ✕ pops back to where they came from; signing in re-renders the
  // profile in place.
  if (!token) {
    return <SignInHero emailHref="/login?back=1" onClose={() => router.back()} />;
  }

  const realizedPnl = trades.reduce((s, t) => s + (t.unrealized_pnl || 0), 0);
  const combinedPnl = totalPnl + realizedPnl;
  const pnlPositive = combinedPnl >= 0;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'posts', label: 'Posts' },
    { key: 'positions', label: 'Positions' },
    { key: 'trades', label: 'Trades' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Nav bar — absolute like artist page */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{username}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 100, paddingBottom: 40 }}>
        {/* Profile header — left-aligned like desktop */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            {avatarUrl
              ? <ExpoImage source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
              : <Text style={styles.avatarLetter}>{username.charAt(0).toUpperCase()}</Text>}
          </View>
          <View style={{ paddingTop: 4 }}>
            <Text style={styles.username}>{username}</Text>
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {[
            { label: 'Volume', value: `$${fmt(totalVolume)}`, color: '#fff' },
            { label: 'P&L', value: `${pnlPositive ? '+' : '-'}$${fmt(Math.abs(combinedPnl))}`, color: pnlPositive ? POSITIVE : NEGATIVE },
            { label: 'Positions', value: String(positions.length), color: '#fff' },
            { label: 'Trades', value: String(trades.length), color: '#fff' },
          ].map((stat, i) => (
            <View key={stat.label} style={[styles.statCell, i < 3 && styles.statCellBorder]}>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {TABS.map(({ key, label }) => (
            <TouchableOpacity key={key} style={styles.tabBtn} onPress={() => setTab(key)}>
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
              {tab === key && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Posts */}
        {tab === 'posts' && (
          postsLoading ? <LoadingView /> :
          posts.length === 0 ? <EmptyView label="No posts yet" /> :
          posts.map(post => <PostRow key={post._id} post={post} token={token} currentUserId={userId} />)
        )}

        {/* Positions */}
        {tab === 'positions' && (
          positionsLoading ? <LoadingView /> :
          positions.length === 0 ? <EmptyView label="No open positions" /> :
          positions.map(pos => {
            const pnlPos = (pos.unrealized_pnl ?? 0) >= 0;
            const pnlPct = pos.total_cost > 0 ? ((pos.unrealized_pnl ?? 0) / pos.total_cost) * 100 : 0;
            return (
              <View key={pos.id} style={styles.row}>
                <View>
                  <Text style={styles.rowArtist}>{pos.artist_name}</Text>
                  <View style={styles.rowMeta}>
                    <View style={[styles.badge, { backgroundColor: pos.position_type === 'long' ? POSITIVE + '20' : NEGATIVE + '20' }]}>
                      <Text style={[styles.badgeText, { color: pos.position_type === 'long' ? POSITIVE : NEGATIVE }]}>
                        {pos.position_type.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.rowSub}>{pos.contracts} contracts</Text>
                    <Text style={styles.rowSub}>Entry ${fmt(pos.entry_price)}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.rowPnl, { color: pnlPos ? POSITIVE : NEGATIVE }]}>
                    {pnlPos ? '+' : '-'}${fmt(Math.abs(pos.unrealized_pnl ?? 0))}
                  </Text>
                  <Text style={styles.rowSub}>{pnlPos ? '+' : ''}{fmt(pnlPct)}%</Text>
                </View>
              </View>
            );
          })
        )}

        {/* Trades */}
        {tab === 'trades' && (
          tradesLoading ? <LoadingView /> :
          trades.length === 0 ? <EmptyView label="No trade history" /> :
          trades.map(pos => {
            const pnlPos = (pos.unrealized_pnl ?? 0) >= 0;
            const pnlPct = pos.total_cost > 0 ? ((pos.unrealized_pnl ?? 0) / pos.total_cost) * 100 : 0;
            return (
              <View key={pos.id} style={styles.row}>
                <View>
                  <Text style={styles.rowArtist}>{pos.artist_name}</Text>
                  <View style={styles.rowMeta}>
                    <View style={[styles.badge, { backgroundColor: pos.position_type === 'long' ? POSITIVE + '20' : NEGATIVE + '20' }]}>
                      <Text style={[styles.badgeText, { color: pos.position_type === 'long' ? POSITIVE : NEGATIVE }]}>
                        {pos.position_type.toUpperCase()}
                      </Text>
                    </View>
                    {pos.status === 'liquidated' && (
                      <View style={[styles.badge, { backgroundColor: '#f9733020' }]}>
                        <Text style={[styles.badgeText, { color: '#f97330' }]}>LIQUIDATED</Text>
                      </View>
                    )}
                    <Text style={styles.rowSub}>{pos.contracts} contracts</Text>
                    <Text style={styles.rowSub}>{fmtDate(pos.closed_at)}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.rowPnl, { color: pnlPos ? POSITIVE : NEGATIVE }]}>
                    {pnlPos ? '+' : '-'}${fmt(Math.abs(pos.unrealized_pnl ?? 0))}
                  </Text>
                  <Text style={styles.rowSub}>{pnlPos ? '+' : ''}{fmt(pnlPct)}%</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// ─── CommentModal ─────────────────────────────────────────────────────────────

function CommentModal({ postId, token, currentUserId, onClose }: {
  postId: string; token: string | null; currentUserId?: string; onClose: () => void;
}) {
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(ENDPOINTS.FEED_COMMENTS.LIST(postId), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => setComments(d.comments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [postId]);

  const handleSubmit = async () => {
    if (!content.trim() || !token || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(ENDPOINTS.FEED_COMMENTS.CREATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId, content: content.trim() }),
      });
      const data = await res.json();
      if (data.comment) {
        setComments(prev => [data.comment, ...prev]);
        setContent('');
        Keyboard.dismiss();
      }
    } catch {} finally { setSubmitting(false); }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={modalStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={modalStyles.header}>
          <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={modalStyles.title}>Comments</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Comments list */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}><GlyphDrawLoader width={24} /></View>
          ) : comments.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <Text style={{ color: '#555', fontSize: 14 }}>No comments yet</Text>
            </View>
          ) : (
            comments.filter(c => !c.parentId).map(c => {
              const name = c.userId?.username || 'Anonymous';
              const { text } = parseTrade(c.content || '');
              const cleanText = removeGifUrls(text);
              return (
                <View key={c._id} style={modalStyles.commentRow}>
                  <View style={modalStyles.commentAvatar}>
                    {c.userId?.avatar_url
                      ? <ExpoImage source={{ uri: c.userId.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18 }} contentFit="cover" />
                      : <Text style={modalStyles.commentAvatarText}>{name.charAt(0).toUpperCase()}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={modalStyles.commentBubble}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <Text style={modalStyles.commentName}>{name}</Text>
                        <Text style={modalStyles.commentTime}>{timeAgo(c.createdAt)}</Text>
                      </View>
                      {cleanText ? <Text style={modalStyles.commentText}>{cleanText}</Text> : null}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Input */}
        {token && (
          <View style={modalStyles.inputBar}>
            <View style={modalStyles.inputRow}>
              <TextInput
                style={modalStyles.input}
                value={content}
                onChangeText={setContent}
                placeholder="Add a comment..."
                placeholderTextColor="#555"
                multiline
              />
              <TouchableOpacity
                style={[modalStyles.sendBtn, (!content.trim() || submitting) && { opacity: 0.4 }]}
                onPress={handleSubmit}
                disabled={!content.trim() || submitting}
              >
                <Text style={modalStyles.sendBtnText}>{submitting ? '...' : 'Post'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BetSlipCard({ trade }: { trade: TradeEmbed }) {
  const isLong = trade.s === 'long';
  const isWin = trade.p >= 0;
  return (
    <View style={betSlipStyles.card}>
      <View style={betSlipStyles.topRow}>
        <Text style={betSlipStyles.artist} numberOfLines={1}>{trade.a}</Text>
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

function GifImage({ uri }: { uri: string }) {
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

function PostRow({ post, token, currentUserId }: { post: Post; token: string | null; currentUserId?: string }) {
  const router = useRouter();
  const name = post.userId?.username || 'Anonymous';
  const { trade, text } = parseTrade(post.content || '');
  const gifUrls = extractGifUrls(text);
  const textContent = removeGifUrls(text);

  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [isLiked, setIsLiked] = useState(post.isLikedByCurrentUser || false);
  const [liking, setLiking] = useState(false);
  const [commentPreview, setCommentPreview] = useState<FeedComment[]>([]);
  const [totalComments, setTotalComments] = useState(0);
  const [showComments, setShowComments] = useState(false);

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

  return (
    <View style={styles.postRow}>
      {/* Post body */}
      <TouchableOpacity activeOpacity={0.85} onPress={() => setShowComments(true)}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={styles.postAvatar}>
            {post.userId?.avatar_url
              ? <ExpoImage source={{ uri: post.userId.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" />
              : <Text style={styles.postAvatarText}>{name.charAt(0).toUpperCase()}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <TouchableOpacity onPress={() => router.push(`/profile/${encodeURIComponent(name)}` as any)}>
                <Text style={styles.postUsername}>{name}</Text>
              </TouchableOpacity>
              <Text style={styles.postTime}>{timeAgo(post.createdAt)}</Text>
            </View>
            {textContent ? <Text style={styles.postContent}>{textContent}</Text> : null}
            {gifUrls.map((url, i) => <GifImage key={i} uri={url} />)}
            {trade && <BetSlipCard trade={trade} />}
          </View>
        </View>
      </TouchableOpacity>

      {/* Action row */}
      <View style={[styles.postActions, { paddingLeft: 56 }]}>
        <TouchableOpacity style={styles.postActionBtn} onPress={handleLike} disabled={!token}>
          <HeartIcon size={18} color={isLiked ? NEGATIVE : '#7a7a7a'} filled={isLiked} />
          {likesCount > 0 && <Text style={[styles.postActionCount, isLiked && { color: NEGATIVE }]}>{likesCount}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.postActionBtn} onPress={() => setShowComments(true)}>
          <MessageCircleIcon size={16} color="#7a7a7a" />
          {totalComments > 0 && <Text style={styles.postActionCount}>{totalComments}</Text>}
        </TouchableOpacity>
      </View>

      {/* Comment preview */}
      {commentPreview.length > 0 && (
        <TouchableOpacity onPress={() => setShowComments(true)} style={styles.commentPreviewWrap}>
          {commentPreview.map(c => {
            const cname = c.userId?.username || 'Anonymous';
            const { text: ct } = parseTrade(c.content || '');
            const cleanText = removeGifUrls(ct);
            return (
              <View key={c._id} style={{ flexDirection: 'row', gap: 6, marginBottom: 2 }}>
                <Text style={styles.commentPreviewName}>{cname}</Text>
                <Text style={styles.commentPreviewText} numberOfLines={1}>{cleanText}</Text>
              </View>
            );
          })}
          {totalComments > 3 && (
            <Text style={styles.viewAllComments}>View all {totalComments} comments</Text>
          )}
        </TouchableOpacity>
      )}

      {showComments && (
        <CommentModal
          postId={post._id}
          token={token}
          currentUserId={currentUserId}
          onClose={() => { setShowComments(false); fetchPreview(); }}
        />
      )}
    </View>
  );
}

function LoadingView() {
  return (
    <View style={{ paddingVertical: 48, alignItems: 'center' }}>
      <GlyphDrawLoader />
    </View>
  );
}

function EmptyView({ label }: { label: string }) {
  return (
    <View style={{ paddingVertical: 48, alignItems: 'center' }}>
      <Text style={{ color: '#555', fontSize: 14 }}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },

  navBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    paddingTop: 60, paddingHorizontal: 16, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.dark.background,
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'flex-start' },
  navTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },

  profileHeader: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 16,
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20,
  },
  avatarWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarLetter: { color: '#000', fontSize: 24, fontWeight: '700' },
  username: { color: '#fff', fontSize: 17, fontWeight: '600' },

  statsGrid: {
    flexDirection: 'row',
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#1c1c1e',
  },
  statCell: { flex: 1, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'flex-start' },
  statCellBorder: { borderRightWidth: 1, borderRightColor: '#1c1c1e' },
  statLabel: { color: '#7a7a7a', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  statValue: { fontSize: 13, fontWeight: '600' },

  tabRow: {
    flexDirection: 'row', borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e', marginTop: 4,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  tabText: { color: '#7a7a7a', fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 2, backgroundColor: '#fff',
  },

  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1c1c1e',
  },
  rowArtist: { color: '#fff', fontSize: 14, fontWeight: '500', marginBottom: 4 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  rowSub: { color: '#555', fontSize: 11 },
  rowPnl: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99 },
  badgeText: { fontSize: 10, fontWeight: '600' },

  postRow: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#1c1c1e',
  },
  postAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
  },
  postAvatarText: { color: '#111', fontSize: 17, fontWeight: '700' },
  postUsername: { color: '#fff', fontSize: 13, fontWeight: '600' },
  postTime: { color: '#7a7a7a', fontSize: 11 },
  postContent: { color: '#fff', fontSize: 13, lineHeight: 19 },
  postActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  postActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  postActionCount: { color: '#7a7a7a', fontSize: 12, fontWeight: '500' },
  commentPreviewWrap: { paddingTop: 6, paddingLeft: 56 },
  commentPreviewName: { color: '#fff', fontSize: 12, fontWeight: '600' },
  commentPreviewText: { color: '#7a7a7a', fontSize: 12, flex: 1 },
  viewAllComments: { color: '#7a7a7a', fontSize: 12, marginTop: 4 },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 20 : 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#1c1c1e',
  },
  closeBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'flex-start' },
  title: { color: '#fff', fontSize: 16, fontWeight: '600' },
  commentRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  commentAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
  },
  commentAvatarText: { color: '#111', fontSize: 14, fontWeight: '700' },
  commentBubble: {
    backgroundColor: '#0d0d0d', borderRadius: 8, paddingHorizontal: 12,
    paddingTop: 8, paddingBottom: 10, flex: 1,
  },
  commentName: { color: '#fff', fontSize: 12, fontWeight: '600' },
  commentTime: { color: '#7a7a7a', fontSize: 10 },
  commentText: { color: '#fff', fontSize: 13, lineHeight: 18 },
  inputBar: {
    borderTopWidth: 1, borderTopColor: '#1c1c1e',
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  input: {
    flex: 1, color: '#fff', fontSize: 14,
    backgroundColor: '#111', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  sendBtn: {
    backgroundColor: '#fff', borderRadius: 99,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  sendBtnText: { color: '#000', fontSize: 13, fontWeight: '500' },
});

const betSlipStyles = StyleSheet.create({
  card: {
    marginTop: 8, borderRadius: 10, borderWidth: 1,
    borderColor: '#262626', backgroundColor: '#0a0a0a', padding: 12, maxWidth: 260,
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
