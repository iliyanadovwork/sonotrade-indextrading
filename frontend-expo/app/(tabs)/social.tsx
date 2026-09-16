import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, Image, Modal, Platform, TouchableOpacity,
  FlatList, RefreshControl, KeyboardAvoidingView, LayoutAnimation, UIManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { GlyphDrawLoader } from '@/components/GlyphDrawLoader';
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

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function SocialScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [posts, setPosts] = useState<FeedPostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const isFetchingRef = useRef(false);
  const currentUserId = (user as any)?.id;
  const [undoPost, setUndoPost] = useState<{ id: string; data: FeedPostType; index: number } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [newPostId, setNewPostId] = useState<string | null>(null);

  const fetchPosts = useCallback(async (reset = false, animate = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      if (reset) offsetRef.current = 0;
      const res = await fetch(ENDPOINTS.FEED.LIST(30, offsetRef.current), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        const newPosts: FeedPostType[] = data.posts || [];
        if (reset) {
          if (animate && newPosts.length > 0) {
            setNewPostId(newPosts[0]._id);
            LayoutAnimation.configureNext({
              duration: 380,
              create: { type: 'easeInEaseOut', property: 'scaleXY' },
              update: { type: 'easeInEaseOut' },
            });
          }
          setPosts(newPosts);
          offsetRef.current = newPosts.length;
        } else {
          setPosts(prev => [...prev, ...newPosts]);
          offsetRef.current += newPosts.length;
        }
        setHasMore(data.hasMore || false);
      }
    } catch { } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [token]);

  useEffect(() => { fetchPosts(true); }, []);

  const handleRefresh = () => { setRefreshing(true); fetchPosts(true); };
  const handleLoadMore = () => {
    if (!hasMore || isFetchingRef.current) return;
    setLoadingMore(true);
    fetchPosts(false);
  };

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
    <View style={[screenStyles.container, { position: 'relative' }]}>
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
      <FlatList
        showsVerticalScrollIndicator={false}
        data={posts}
        keyExtractor={item => item._id}
        ListHeaderComponent={
          <FeedPostForm onPostAdded={() => fetchPosts(true)} token={token} user={user as any} />
        }
        renderItem={({ item }) => (
          <FeedPostItem
            post={item}
            currentUserId={currentUserId}
            token={token}
            onDelete={handleDelete}
            isNew={item._id === newPostId}
            onRequireAuth={() => router.push('/welcome?back=1')}
          />
        )}
        ItemSeparatorComponent={() => <View style={screenStyles.separator} />}
        ListEmptyComponent={
          loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
              <GlyphDrawLoader />
            </View>
          ) : (
            <Text style={screenStyles.empty}>No posts yet. Be the first to share!</Text>
          )
        }
        ListFooterComponent={loadingMore ? <View style={{ paddingVertical: 24, alignItems: 'center' }}><GlyphDrawLoader width={24} /></View> : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
      <UndoToast visible={!!undoPost} message="Post deleted" onUndo={handleUndoDelete} />

      {token && (
        <TouchableOpacity style={screenStyles.fab} onPress={() => setShowPostModal(true)} activeOpacity={0.85}>
          <Text style={screenStyles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showPostModal} transparent animationType="slide" onRequestClose={() => setShowPostModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={screenStyles.modalSheet}>
            <View style={screenStyles.modalHeader}>
              <TouchableOpacity onPress={() => setShowPostModal(false)}>
                <Text style={screenStyles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={screenStyles.modalTitle}>New Post</Text>
              <View style={{ width: 56 }} />
            </View>
            <FeedPostForm
              onPostAdded={() => { fetchPosts(true, true); setShowPostModal(false); }}
              token={token}
              user={user as any}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
