import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useGlobalToasts } from '../contexts/ToastContext';

const HeartIcon = ({ filled, animating }) => (
  <svg
    width="24" height="24" viewBox="0 0 24 24"
    fill={filled ? '#ed4956' : 'none'} stroke="#262626"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{
      cursor: 'pointer',
      display: 'inline-block',
      transform: animating ? 'scale(1.3)' : 'scale(1)',
      transition: 'transform 200ms ease-out',
    }}
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 
      5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 
      1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const ShareIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24"
       fill="none" stroke="#262626" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round"
       style={{ cursor: 'pointer' }}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const BookmarkIcon = ({ filled }) => (
  <svg width="24" height="24" viewBox="0 0 24 24"
       fill={filled ? '#262626' : 'none'} stroke="#262626"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
       style={{ cursor: 'pointer' }}>
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 
      2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

const renderAvatar = (user, size = 40) => {
  const style = {
    width: size,
    height: size,
    borderRadius: '50%',
    objectFit: 'cover',
    backgroundColor: '#ddd',
    color: '#555',
    display: 'inline-block',
    textAlign: 'center',
    lineHeight: `${size}px`,
    fontSize: size * 0.5,
    marginRight: 12,
    flexShrink: 0,
  };
  
  const src = user.profile_photo_url || user.profilePhotoUrl;
  if (src) return <img src={src} alt="" style={style} />;
  return <div style={style}>{(user.username || '?').charAt(0).toUpperCase()}</div>;
};

const renderRawAvatar = (src, size = 40) => {
  const style = {
    width: size,
    height: size,
    borderRadius: '50%',
    objectFit: 'cover',
    backgroundColor: '#ddd',
    color: '#555',
    display: 'inline-block',
    textAlign: 'center',
    lineHeight: `${size}px`,
    fontSize: size * 0.5,
    marginRight: 12,
    flexShrink: 0,
  };
  
  return <img src={src} alt="" style={style} />;
};


function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return 'Just now';
  if (diff < hour) {
    const m = Math.floor(diff / minute);
    return `${m} minute${m !== 1 ? 's' : ''} ago`;
  }
  if (diff < day) {
    const h = Math.floor(diff / hour);
    return `${h} hour${h !== 1 ? 's' : ''} ago`;
  }
  if (diff < 3 * day) {
    const d = Math.floor(diff / day);
    return `${d} day${d !== 1 ? 's' : ''} ago`;
  }
  const monthStr = date.toLocaleString('en-US', { month: 'short' });
  const dayNum = date.getDate();
  const suffix =
    dayNum % 10 === 1 && dayNum !== 11 ? 'st' :
    dayNum % 10 === 2 && dayNum !== 12 ? 'nd' :
    dayNum % 10 === 3 && dayNum !== 13 ? 'rd' : 'th';
  return `${monthStr} ${dayNum}${suffix}`;
}

export default function PostCard({ post: initialPost, user, isBookmarked, onToggleBookmark }) {
  const [post, setPost] = useState(initialPost);
  const [comments, setComments] = useState([]);
  const [visibleComments, setVisibleComments] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [relativeTime, setRelativeTime] = useState('');
  
  const [optimisticIsBookmarked, setOptimisticIsBookmarked] = useState(isBookmarked);

  useEffect(() => {
    setOptimisticIsBookmarked(isBookmarked);
  }, [isBookmarked]);

  const rtImage = "https://cdn.bsky.app/img/avatar/plain/did:plc:zimtt7q4ei2pcqupfr7s4alp/bafkreibdx6dmjwgmibrqerljzot5ztfvuvx4mxibu6ksah2aswocw5nkqe@jpeg"
  const rtHandle = "Rotten Tomatoes"

  const { addToast } = useGlobalToasts();

  useEffect(() => {
    if (post && (post.createdAt || post.created_at)) {
      setRelativeTime(formatRelativeTime(post.createdAt || post.created_at));
      fetchComments();
    }

    console.log(post)
  }, [post]);

  const toggleLike = async () => {
    setLikeAnimating(true);
    try {
      const postId = post.post_id || post.id;
      const { data } = await axios.post(`/api/feed/${postId}/like`);
      if (data.success) {
        setPost(p => ({
          ...p,
          user_has_liked: data.liked,
          likes_count: data.newLikeCount,
        }));
      }
    } catch (e) {
      console.error('Error toggling like:', e);
    } finally {
      setTimeout(() => setLikeAnimating(false), 300);
    }
  };

  const fetchComments = async () => {
    if (!post || !(post.post_id || post.id)) return;
    try {
      const { data } = await axios.get(`/api/feed/${post.post_id || post.id}/comments`);
      setComments(data);
    } catch (e) {
      console.error('Error fetching comments:', e);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast({
        content: 'Copied link to Clipboard!',
        type: 'success',
      });
    } catch (err) {
      console.error('Failed to copy: ', err);
      addToast('Failed to copy!', 'error');
    }
  };

  const submitComment = async () => {
    const text = commentInput.trim();
    if (!text) return;
    try {
      const { data } = await axios.post(
        `/api/feed/${post.post_id || post.id}/comment`,
        { comment_text: text }
      );
      if (data.success) {
        setComments(c => [data.comment, ...c]);
        if(post.comments_count)
          setPost(p => ({ ...p, comments_count: p.comments_count + 1 }));
        if(post.commentsCount)
          setPost(p => ({...p, commentsCount: p.commentsCount + 1 }));

        setCommentInput('');
        if (!visibleComments) setVisibleComments(true);
      }
    } catch (e) {
      console.error('Error submitting comment:', e);
    }
  };

  const handleBookmarkClick = async (e) => {
    e.stopPropagation();
    if (!post || !(post.post_id || post.id)) {
        console.error('Post ID is missing for bookmark action.');
        return;
    }
    if (!user) {
        console.log('User not logged in, cannot bookmark.');
        return;
    }

    const currentPostId = post.post_id || post.id;
    const previousOptimisticState = optimisticIsBookmarked;

    setOptimisticIsBookmarked(!previousOptimisticState);

    try {
        if (previousOptimisticState) {
            await axios.delete(`/api/bookmarks/${currentPostId}`);
        } else {
            await axios.post(`/api/bookmarks/${currentPostId}`);
        }
        if (onToggleBookmark) {
            onToggleBookmark();
        }
    } catch (err) {
        console.error('Error toggling bookmark:', err);
        setOptimisticIsBookmarked(previousOptimisticState);
    }
  };

  return (
    post && user ? (
      <div style={{
        backgroundColor: '#fff',
        borderRadius: 12,
        boxShadow: '0 6px 20px rgba(0,0,0,0.1)',
        marginBottom: 24,
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #eee',
        }}>
          {post.is_bluesky ? renderRawAvatar(rtImage) : renderAvatar(post.author, 36)}
          <Link to={`/profile/${post.is_bluesky ? "rottentomatoes.com" : post.author.username}`} style={{
            fontWeight: '600',
            color: '#262626',
            textDecoration: 'none',
            flexGrow: 1,
          }}>
            {post.is_bluesky ? rtHandle : post.author.username}
          </Link>
          <div style={{ fontSize: 24, color: '#888', cursor: 'pointer' }}>⋯</div>
        </div>

        {(post.image_url || post.imageUrl) && (
          <img
            src={(post.image_url || post.imageUrl)}
            alt=""
            style={{
              width: '100%',
              display: 'block',
              backgroundColor: '#efefef',
              maxHeight: 600,
              objectFit: 'cover',
            }}
          />
        )}

        <div style={{ padding: '8px 16px' }}>
          <span style={{ color: '#262626', lineHeight: 1.5 }}>{post.content || post.text || post.post_text}</span>
          {Array.isArray(post.hashtags) && post.hashtags.length > 0 && (
            <div style={{
              marginTop: 6,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 5,
            }}>
              {post.hashtags.map((tag, i) => (
                <span key={i} style={{
                  backgroundColor: '#e9ecef',
                  color: '#007bff',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.8em',
                  fontWeight: '500',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 16px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <div onClick={toggleLike}>
              <HeartIcon filled={post.user_has_liked} animating={likeAnimating} />
            </div>
            <span style={{
              fontWeight: '600',
              fontSize: 14,
              color: '#262626',
              marginTop: '-8px'
            }}>
              {post.likes_count || post.likesCount}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
          <div onClick={() => copyToClipboard(
              `${window.location.origin}/posts/${post.post_type}-${post.post_id || post.postId}`
      ) }>
                  <ShareIcon /> 
              </div>
            {user && (
              <div onClick={handleBookmarkClick} title={optimisticIsBookmarked ? "Remove Bookmark" : "Add Bookmark"}>
                <BookmarkIcon filled={optimisticIsBookmarked} />
              </div>
            )}
          </div>
        </div>
        {
         ((post.comments_count && post.comments_count > 0) || 
          (post.commentsCount && post.commentsCount > 0))  ? 
          <span
              onClick={() => {fetchComments(); setVisibleComments(!visibleComments);}}
              style={{
                marginLeft: 12,
                fontSize: 14,
                color: '#8e8e8e',
                cursor: 'pointer',
                marginTop: '-8px',
              }}
            >
              {(post.comments_count || post.commentsCount) > 0
                ? `View all ${post.comments_count || post.commentsCount} comments`
                : ''}
            </span> : <span></span>
        }

        {visibleComments && (
          <div style={{ padding: '0 16px 12px' }}>
            {comments.map((c, i) => (
              <div key={i} style={{ marginBottom: 4, display: 'flex', alignItems: 'center'}}>
                <img src={c.author_profile_photo_url}
                     alt=""
                     style={{
                       width: 32,
                       height: 32,
                       objectFit: 'cover',
                       borderRadius: '50%',
                       marginRight: 8,
                     }}
                />
                <b>{c.author_username}</b> {"   "} &nbsp; {c.comment_text}
              </div>
            ))}
          </div>
        )}

        <div style={{
          padding: '0 16px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginLeft: '-10px'
        }}>
          <input
            value={commentInput}
            onChange={e => setCommentInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitComment()}
            placeholder="Add a comment..."
            style={{
              flexGrow: 1,
              border: 'none',
              borderBottom: '1px solid #ddd',
              padding: 8,
              fontSize: 14,
            }}
          />
          <button
            onClick={submitComment}
            style={{
              background: 'none',
              border: 'none',
              color: '#3897f0',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Post
          </button>
        </div>

        <div style={{
          padding: '0 16px 12px',
          fontSize: 12,
          color: '#8e8e8e',
        }}>
          {relativeTime}
        </div>
      </div>
    ) : null
  );
}