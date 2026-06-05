import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Heart, ThumbsDown, MessageCircle, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function CommentItem({ comment, user, gameId, depth = 0 }) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplies, setShowReplies] = useState(false);
  const queryClient = useQueryClient();

  const { data: replies = [] } = useQuery({
    queryKey: ['replies', comment.id],
    queryFn: () => base44.entities.Comment.filter({ parent_id: comment.id, game_id: gameId }),
    enabled: showReplies,
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      const likes = comment.likes || [];
      const dislikes = (comment.dislikes || []).filter(id => id !== user.id);
      const newLikes = likes.includes(user.id) ? likes.filter(id => id !== user.id) : [...likes, user.id];
      await base44.entities.Comment.update(comment.id, { likes: newLikes, dislikes });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', gameId] }),
  });

  const dislikeMutation = useMutation({
    mutationFn: async () => {
      const dislikes = comment.dislikes || [];
      const likes = (comment.likes || []).filter(id => id !== user.id);
      const newDislikes = dislikes.includes(user.id) ? dislikes.filter(id => id !== user.id) : [...dislikes, user.id];
      await base44.entities.Comment.update(comment.id, { dislikes: newDislikes, likes });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', gameId] }),
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Comment.create({
        game_id: gameId,
        user_id: user.id,
        user_name: user.full_name,
        user_photo: user.profile_photo || '',
        content: replyText,
        parent_id: comment.id,
        likes: [],
        dislikes: [],
      });
    },
    onSuccess: () => {
      setReplyText('');
      setShowReply(false);
      setShowReplies(true);
      queryClient.invalidateQueries({ queryKey: ['replies', comment.id] });
      queryClient.invalidateQueries({ queryKey: ['comments', gameId] });
    },
  });

  const isLiked = (comment.likes || []).includes(user?.id);
  const isDisliked = (comment.dislikes || []).includes(user?.id);

  return (
    <div className={`${depth > 0 ? 'ml-8 pl-4 border-l-2 border-border/50' : ''}`}>
      <div className="flex gap-3 py-3">
        <div className="flex-shrink-0">
          {comment.user_photo ? (
            <img src={comment.user_photo} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
              {comment.user_name?.[0] || '?'}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold">{comment.user_name}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_date), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{comment.content}</p>
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={() => user && likeMutation.mutate()}
              className={`flex items-center gap-1 text-xs transition-colors ${isLiked ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
            >
              <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-primary' : ''}`} />
              {(comment.likes || []).length || ''}
            </button>
            <button
              onClick={() => user && dislikeMutation.mutate()}
              className={`flex items-center gap-1 text-xs transition-colors ${isDisliked ? 'text-destructive' : 'text-muted-foreground hover:text-destructive'}`}
            >
              <ThumbsDown className={`w-3.5 h-3.5 ${isDisliked ? 'fill-destructive' : ''}`} />
              {(comment.dislikes || []).length || ''}
            </button>
            <button
              onClick={() => setShowReply(!showReply)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Reply
            </button>
          </div>

          {showReply && user && (
            <div className="flex gap-2 mt-3">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                className="min-h-[60px] text-sm"
              />
              <Button size="sm" onClick={() => replyMutation.mutate()} disabled={!replyText.trim()}>
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          {depth === 0 && (
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
            >
              {showReplies ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showReplies ? 'Hide replies' : 'View replies'}
            </button>
          )}

          {showReplies && replies.map(reply => (
            <CommentItem key={reply.id} comment={reply} user={user} gameId={gameId} depth={depth + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CommentSection({ gameId, user }) {
  const [text, setText] = useState('');
  const queryClient = useQueryClient();

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', gameId],
    queryFn: () => base44.entities.Comment.filter({ game_id: gameId, parent_id: '' }),
  });

  // Also get comments without parent_id set at all
  const { data: allComments = [] } = useQuery({
    queryKey: ['all-comments', gameId],
    queryFn: () => base44.entities.Comment.filter({ game_id: gameId }),
  });

  const topLevelComments = allComments.filter(c => !c.parent_id);

  const postMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Comment.create({
        game_id: gameId,
        user_id: user.id,
        user_name: user.full_name,
        user_photo: user.profile_photo || '',
        content: text,
        parent_id: '',
        likes: [],
        dislikes: [],
      });
    },
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries({ queryKey: ['comments', gameId] });
      queryClient.invalidateQueries({ queryKey: ['all-comments', gameId] });
    },
  });

  return (
    <div className="space-y-4">
      <h3 className="font-heading text-xl tracking-wide">Discussion</h3>

      {user && (
        <div className="flex gap-3">
          <div className="flex-shrink-0 mt-1">
            {user.profile_photo ? (
              <img src={user.profile_photo} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                {user.full_name?.[0]}
              </div>
            )}
          </div>
          <div className="flex-1 flex gap-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a comment..."
              className="min-h-[60px] text-sm"
            />
            <Button onClick={() => postMutation.mutate()} disabled={!text.trim()} className="self-end">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="divide-y divide-border/50">
        {topLevelComments.map(comment => (
          <CommentItem key={comment.id} comment={comment} user={user} gameId={gameId} />
        ))}
        {topLevelComments.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">No comments yet. Be the first!</p>
        )}
      </div>
    </div>
  );
}