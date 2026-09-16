import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Spinner } from '@/components/Spinner';
import { SonotradeHeader } from '@/components/SonotradeHeader';
import { UndoToast } from '@/components/UndoToast';
import { useAuth } from '@/context/AuthContext';
import { ENDPOINTS } from '@/constants/API';
import {
  type FeedPostType,
  FeedPostItem,
  FeedPostForm,
  screenStyles,
} from '@/components/SocialFeedShared';

const PAGE_SIZE = 30;

export default function SocialScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [posts, setPosts] = useState<FeedPostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);
  const isFetchingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const currentUserId = (user as any)?.id;
  const [undoPost, setUndoPost] = useState<{ id: string; data: FeedPostType; index: number } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPosts = useCallback(async (reset = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      if (reset) offsetRef.current = 0;
      const res = await fetch(ENDPOINTS.FEED.LIST(PAGE_SIZE, offsetRef.current), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        const newPosts: FeedPostType[] = data.posts || [];
        if (reset) {
          setPosts(newPosts);
          offsetRef.current = newPosts.length;
        } else {
          setPosts(prev => [...prev, ...newPosts]);
          offsetRef.current += newPosts.length;
        }
        hasMoreRef.current = data.hasMore || false;
      }
    } catch { } finally {
      isFetchingRef.current = false;
      loadingMoreRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }, [token]);

  useEffect(() => { fetchPosts(true); }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      if (total - scrolled < 600 && !loadingMoreRef.current && hasMoreRef.current) {
        loadingMoreRef.current = true;
        setLoadingMore(true);
        fetchPosts(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fetchPosts]);

  const handleDelete = useCallback((postId: string) => {
    setPosts(prev => {
      const index = prev.findIndex(p => p._id === postId);
      const post = prev[index];
      if (!post) return prev;
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setUndoPost({ id: postId, data: post, index });
      undoTimerRef.current = setTimeout(async () => {
        try {
          await fetch(ENDPOINTS.FEED.DELETE(postId), {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch { }
        setUndoPost(null);
      }, 4000);
      return prev.filter(p => p._id !== postId);
    });
  }, [token]);

  const handleUndoDelete = useCallback(() => {
    if (!undoPost) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setPosts(prev => {
      const next = [...prev];
      next.splice(undoPost.index, 0, undoPost.data);
      return next;
    });
    setUndoPost(null);
  }, [undoPost]);

  return (
    <View style={[screenStyles.container, { position: 'relative', touchAction: 'pan-y', overflow: 'visible' } as any]}>
      <SonotradeHeader right={
        <TouchableOpacity
          onPress={() => router.push('/profile' as any)}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#27272a', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        >
          {(user as any)?.avatar_url
            ? <Image source={{ uri: (user as any).avatar_url }} style={{ width: 32, height: 32, borderRadius: 16 }} />
            : <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{((user as any)?.username || 'A').charAt(0).toUpperCase()}</Text>}
        </TouchableOpacity>
      } />

      <FeedPostForm onPostAdded={() => fetchPosts(true)} token={token} user={user as any} />

      {loading ? (
        <View style={{ minHeight: 'calc(100vh - 120px)' as any, justifyContent: 'center', alignItems: 'center' }}>
          <Spinner size={32} />
        </View>
      ) : posts.length === 0 ? (
        <Text style={screenStyles.empty}>No posts yet. Be the first to share!</Text>
      ) : (
        <>
          {posts.map((item, index) => (
            <React.Fragment key={item._id}>
              {index > 0 && <View style={screenStyles.separator} />}
              <FeedPostItem
                post={item}
                currentUserId={currentUserId}
                token={token}
                onDelete={handleDelete}
              />
            </React.Fragment>
          ))}
          {loadingMore && (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <Spinner size={24} />
            </View>
          )}
        </>
      )}

      <View style={{ height: 80 }} />
      <UndoToast visible={!!undoPost} message="Post deleted" onUndo={handleUndoDelete} />
    </View>
  );
}
