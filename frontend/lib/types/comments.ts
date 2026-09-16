export interface CommentUser {
  _id: string
  username?: string
  avatar_url?: string | null
}

export interface Comment {
  _id: string
  userId: CommentUser
  eventId: string
  content: string
  parentId?: string
  likesCount: number
  isLikedByCurrentUser: boolean
  createdAt: string
  updatedAt: string
}

export interface CommentListProps {
  comments: Comment[]
  isLoading: boolean
  onReply: (commentId: string) => void
  onDelete: (commentId: string) => void
  replyingTo: string
  eventId: string
  onReplyAdded: (comment: Comment) => void
  onReplyFailed?: (optimisticId: string) => void
  currentUserId?: string
  hasMore: boolean
  onLoadMore: () => void
  isFetching: boolean
}

export interface CommentProps {
  comment: Comment
  onReply?: (commentId: string) => void
  onDelete?: (commentId: string) => void
  currentUserId?: string
}

export interface CommentFormProps {
  eventId: string
  onCommentAdded: (comment: Comment) => void
}

export interface ReplyFormProps {
  parentId: string
  eventId: string
  onReplyAdded: (comment: Comment) => void
  onReplyFailed?: (optimisticId: string) => void
  onCancel: () => void
  parentComment: Comment
}
