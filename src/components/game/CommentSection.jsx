import { useMemo, useRef, useState } from 'react';
import { appClient } from '@/api/backendClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Heart, ThumbsDown, MessageCircle, Send, ChevronDown, ChevronUp, AtSign } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const uniqueById = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const buildMentionRegex = (names = []) => {
  const tokens = names
    .map((name) => name?.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex);

  if (!tokens.length) return null;
  return new RegExp(`@(${tokens.join('|')})(?=\\s|$|[^\\w])`, 'gi');
};

const extractMentionedIds = (text, mentionCandidates = []) => {
  const lowered = text.toLowerCase();
  return uniqueById(
    mentionCandidates.filter((person) => {
      const name = person?.full_name?.trim();
      if (!name) return false;
      const regex = new RegExp(`(^|[^\\w])@${escapeRegex(name)}(?=\\s|$|[^\\w])`, 'i');
      return regex.test(text) || lowered.includes(`@${name.toLowerCase()}`);
    })
  ).map((person) => person.id);
};

const MentionText = ({ content, mentionNames = [] }) => {
  const regex = useMemo(() => buildMentionRegex(mentionNames), [mentionNames]);

  if (!regex) {
    return <>{content}</>;
  }

  const nodes = [];
  let lastIndex = 0;
  let match;
  regex.lastIndex = 0;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(content.slice(lastIndex, match.index));
    }
    nodes.push(
      <span key={`${match.index}-${match[1]}`} className="font-medium text-primary">
        @{match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    nodes.push(content.slice(lastIndex));
  }

  return <>{nodes}</>;
};

function CommentComposer({
  user,
  placeholder,
  onSubmit,
  mentionCandidates,
  buttonLabel = 'Send',
}) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  const insertMention = (name) => {
    const mention = `@${name} `;
    const el = textareaRef?.current;
    if (!el) {
      setText((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}${mention}`);
      return;
    }

    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = `${text.slice(0, start)}${mention}${text.slice(end)}`;
    setText(next);

    requestAnimationFrame(() => {
      const nextPos = start + mention.length;
      el.focus();
      el.setSelectionRange(nextPos, nextPos);
    });
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const mentionUserIds = extractMentionedIds(trimmed, mentionCandidates);
    await onSubmit({ text: trimmed, mentionUserIds, setText });
  };

  return (
    <div className="space-y-3">
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
        <div className="flex-1 space-y-2">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            className="min-h-[72px] text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 overflow-x-auto py-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1 pr-1">
                <AtSign className="w-3 h-3" />
                Tag
              </span>
              {mentionCandidates.slice(0, 12).map((person) => (
                <Button
                  key={person.id}
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => insertMention(person.full_name)}
                >
                  @{person.full_name}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <Button onClick={handleSubmit} disabled={!text.trim()}>
          <Send className="w-4 h-4 mr-2" />
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}

function CommentItem({ comment, user, gameId, depth = 0, mentionById = new Map(), game }) {
  const [showReply, setShowReply] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const queryClient = useQueryClient();

  const mentionNames = (comment.mention_user_ids || [])
    .map((id) => mentionById.get(id)?.full_name)
    .filter(Boolean);

  const { data: replies = [] } = useQuery({
    queryKey: ['replies', comment.id],
    queryFn: () => appClient.entities.Comment.filter({ parent_id: comment.id, game_id: gameId }),
    enabled: showReplies,
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      const likes = comment.likes || [];
      const dislikes = (comment.dislikes || []).filter((id) => id !== user.id);
      const newLikes = likes.includes(user.id) ? likes.filter((id) => id !== user.id) : [...likes, user.id];
      await appClient.entities.Comment.update(comment.id, { likes: newLikes, dislikes });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', gameId] }),
  });

  const dislikeMutation = useMutation({
    mutationFn: async () => {
      const dislikes = comment.dislikes || [];
      const likes = (comment.likes || []).filter((id) => id !== user.id);
      const newDislikes = dislikes.includes(user.id) ? dislikes.filter((id) => id !== user.id) : [...dislikes, user.id];
      await appClient.entities.Comment.update(comment.id, { dislikes: newDislikes, likes });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', gameId] }),
  });

  const replyMutation = useMutation({
    mutationFn: async ({ text, mentionUserIds }) => {
      await appClient.entities.Comment.create({
        game_id: gameId,
        user_id: user.id,
        user_name: user.full_name,
        user_photo: user.profile_photo || '',
        content: text,
        mention_user_ids: mentionUserIds,
        parent_id: comment.id,
        likes: [],
        dislikes: [],
      });
    },
    onSuccess: () => {
      setShowReply(false);
      setShowReplies(true);
      queryClient.invalidateQueries({ queryKey: ['replies', comment.id] });
      queryClient.invalidateQueries({ queryKey: ['comments', gameId] });
    },
  });

  const isLiked = (comment.likes || []).includes(user?.id);
  const isDisliked = (comment.dislikes || []).includes(user?.id);

  const handleReplySubmit = async ({ text, mentionUserIds, setText }) => {
    await replyMutation.mutateAsync({ text, mentionUserIds });
    setText('');

    await Promise.all(
      mentionUserIds
        .filter((id) => id !== user.id)
        .map((id) =>
          appClient.entities.Notification.create({
            user_id: id,
            type: 'mention',
            title: `${user.full_name} mentioned you`,
            message: `You were tagged in a reply on "${game?.title || 'your game'}".`,
            game_id: gameId,
            dedupe_key: `mention:${gameId}:${comment.id}:reply:${id}`,
          })
        )
    );
  };

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
          <p className="text-sm text-foreground/90 whitespace-pre-wrap">
            <MentionText content={comment.content} mentionNames={mentionNames} />
          </p>
          {!!mentionNames.length && (
            <div className="mt-2 flex flex-wrap gap-1">
              {mentionNames.map((name) => (
                <Badge key={`${comment.id}-${name}`} variant="secondary" className="text-[10px]">
                  @{name}
                </Badge>
              ))}
            </div>
          )}
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
            <div className="mt-3">
              <CommentComposer
                user={user}
                placeholder="Write a reply..."
                mentionCandidates={Array.from(mentionById.values())}
                buttonLabel="Reply"
                onSubmit={handleReplySubmit}
              />
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

          {showReplies && replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} user={user} gameId={gameId} depth={depth + 1} mentionById={mentionById} game={game} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CommentSection({ gameId, user, game, players = [] }) {
  const queryClient = useQueryClient();
  const mentionById = useMemo(() => new Map(uniqueById(players).map((player) => [player.id, player])), [players]);
  const mentionCandidates = useMemo(() => uniqueById(players).filter((player) => player.full_name), [players]);

  const { data: allComments = [] } = useQuery({
    queryKey: ['all-comments', gameId],
    queryFn: () => appClient.entities.Comment.filter({ game_id: gameId }),
  });

  const topLevelComments = allComments.filter((c) => !c.parent_id);

  const postMutation = useMutation({
    mutationFn: async ({ text, mentionUserIds }) => {
      const created = await appClient.entities.Comment.create({
        game_id: gameId,
        user_id: user.id,
        user_name: user.full_name,
        user_photo: user.profile_photo || '',
        content: text,
        mention_user_ids: mentionUserIds,
        parent_id: '',
        likes: [],
        dislikes: [],
      });

      await Promise.all(
        mentionUserIds
          .filter((id) => id !== user.id)
          .map((id) =>
            appClient.entities.Notification.create({
              user_id: id,
              type: 'mention',
              title: `${user.full_name} mentioned you`,
              message: `You were tagged in a post on "${game?.title || 'your game'}".`,
              game_id: gameId,
              dedupe_key: `mention:${gameId}:${created.id}:${id}`,
            })
          )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-comments', gameId] });
    },
  });

  return (
    <div className="space-y-4">
      <h3 className="font-heading text-xl tracking-wide">Discussion</h3>

      {user && (
        <CommentComposer
          user={user}
          placeholder="Add a comment or tag people..."
          mentionCandidates={mentionCandidates}
          buttonLabel="Post"
          onSubmit={postMutation.mutateAsync}
        />
      )}

      <div className="divide-y divide-border/50">
        {topLevelComments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            user={user}
            gameId={gameId}
            mentionById={mentionById}
            game={game}
          />
        ))}
        {topLevelComments.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">No comments yet. Be the first!</p>
        )}
      </div>
    </div>
  );
}
