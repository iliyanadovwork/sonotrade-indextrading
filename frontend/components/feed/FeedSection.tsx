'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import FeedForm from './FeedForm'
import FeedPost, { FeedPostType } from './FeedPost'
import { CSXText } from '@/components/sx/core/CSXText'
import { SXGlyphDrawLoader } from '@/components/sx/SXGlyphDrawLoader'
import { SXPageLoading } from '@/components/sx/SXPageLoading'

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export const FeedSection: React.FC = () => {
  const [posts, setPosts] = useState<FeedPostType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | undefined>()
  const offsetRef = useRef(0)
  const isFetchingRef = useRef(false)
  const observer = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null')
      if (user?.id) setCurrentUserId(user.id)
    } catch {}
  }, [])

  const fetchPosts = useCallback(async (reset: boolean = false) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    try {
      if (reset) {
        setIsLoading(true)
        offsetRef.current = 0
      } else {
        setIsFetching(true)
      }

      const res = await fetch(`/api/feed?limit=10&offset=${offsetRef.current}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      })
      const data = await res.json()

      if (data.success) {
        const newPosts = data.posts || []
        if (reset) {
          setPosts(newPosts)
          offsetRef.current = newPosts.length
        } else {
          setPosts((prev) => [...prev, ...newPosts])
          offsetRef.current += newPosts.length
        }
        setHasMore(data.hasMore || false)
      }
    } catch (error) {
      console.error('Fetch feed error:', error)
    } finally {
      isFetchingRef.current = false
      setIsLoading(false)
      setIsFetching(false)
    }
  }, [])

  useEffect(() => {
    fetchPosts(true)
  }, [])

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observer.current) observer.current.disconnect()
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingRef.current) {
          fetchPosts(false)
        }
      }, { rootMargin: '200px' })
      if (node) observer.current.observe(node)
    },
    [hasMore, fetchPosts]
  )

  /**
   * Prepend the created post instead of refetching the feed.
   *
   * This used to call fetchPosts(true), which sets isLoading and therefore
   * unmounted the entire list behind the full-page loader — the whole feed
   * flashed, every post remounted, and any expanded comments and scroll
   * position were lost. POST /api/feed already returns the created post, so
   * nothing needs to be re-read.
   */
  const handlePostAdded = useCallback((newPost?: FeedPostType) => {
    if (!newPost) {
      fetchPosts(true)
      return
    }
    setPosts(prev => (prev.some(p => p._id === newPost._id)
      ? prev
      : [{ ...newPost, comments: newPost.comments ?? [] }, ...prev]))
    // Keep the pagination cursor aligned with the list length, or the next
    // infinite-scroll page would repeat a post.
    offsetRef.current += 1
  }, [fetchPosts])

  const handleDelete = useCallback(async (postId: string) => {
    // Optimistic removal, for the same reason: a refetch here flashed the feed.
    const snapshot = posts
    setPosts(prev => prev.filter(p => p._id !== postId))
    offsetRef.current = Math.max(0, offsetRef.current - 1)
    try {
      const res = await fetch(`/api/feed/${postId}`, { method: 'DELETE', headers: getAuthHeaders() })
      if (!res.ok) throw new Error(`delete failed: ${res.status}`)
    } catch (error) {
      console.error('Delete post error:', error)
      setPosts(snapshot)
      offsetRef.current = snapshot.length
    }
  }, [posts])

  if (isLoading) {
    return <SXPageLoading aria-label="Loading feed" />
  }

  return (
    <div>
      <FeedForm onPostAdded={handlePostAdded} />
      {/* No inner cap — the page column (FEED_COLUMN_WIDTH_PX) sets the width. */}
      <div>
        {posts.length === 0 ? (
          <div className="py-12 text-center">
            <CSXText variant="body2" color="STMuted">
              No posts yet. Be the first to share!
            </CSXText>
          </div>
        ) : (
          <>
            <div>
              {posts.map((post, index) => (
                <FeedPost
                  key={post._id}
                  post={post}
                  currentUserId={currentUserId}
                  onDelete={handleDelete}
                  isFirst={index === 0}
                />
              ))}
            </div>
            <div ref={sentinelRef} className="flex justify-center py-4">
              {isFetching && (
                <SXGlyphDrawLoader width={48} aria-label="Loading more posts" />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default FeedSection
