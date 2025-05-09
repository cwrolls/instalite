import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom'; 

// toast noti
const Toast = ({ message, type = 'error', onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 20px',
      backgroundColor: type === 'error' ? '#f8d7da' : '#d4edda',
      color: type === 'error' ? '#721c24' : '#155724',
      border: `1px solid ${type === 'error' ? '#f5c6cb' : '#c3e6cb'}`,
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      zIndex: 1000,
      fontSize: '15px',
    }}>
      {message}
      <button onClick={onDismiss} style={{ marginLeft: '15px', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
    </div>
  );
};

const Card = ({ children, style = {} }) => (
  <div style={{
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 5px 15px rgba(0, 0, 0, 0.08)',
    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
    ...style
  }}
  onMouseOver={e => e.currentTarget.style.transform = 'translateY(-3px)'}
  onMouseOut={e => e.currentTarget.style.transform = 'translateY(0px)'}
  >
    {children}
  </div>
);

const Avatar = ({ photoUrl, name, size = 40, style = {} }) => {
  const baseStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    backgroundColor: '#e0e0e0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size * 0.45,
    color: '#555555',
    fontWeight: '500',
    flexShrink: 0,
    objectFit: 'cover',
    marginRight: '12px',
    ...style
  };
  if (photoUrl) {
    return <img src={photoUrl} alt={name || 'Avatar'} style={baseStyle} />;
  }
  return <div style={baseStyle}>{name?.charAt(0).toUpperCase() || '?'}</div>;
};

const ActorMovieCard = ({ item }) => (
  <Card style={{ marginBottom: '15px' }}>
    <h4 style={{ marginTop: 0, marginBottom: '8px', color: '#2c3e50' }}>
      🎬 {item.metadata.primaryTitle || 'Movie/Show'} ({item.metadata.startYear || 'N/A'})
    </h4>
    <p style={{ fontSize: '14px', color: '#555', margin: '4px 0' }}>
      <strong>Actor:</strong> {item.metadata.primaryName || 'N/A'}
    </p>
    <p style={{ fontSize: '14px', color: '#555', margin: '4px 0' }}>
      <strong>Role:</strong> {item.metadata.characters ? JSON.parse(item.metadata.characters).join(', ') : (item.metadata.job || item.metadata.category || 'N/A')}
    </p>
    {item.metadata.averageRating && (
      <p style={{ fontSize: '14px', color: '#555', UserCardmargin: '4px 0' }}>
        <strong>Rating:</strong> {item.metadata.averageRating}/10
      </p>
    )}
    <p style={{ fontSize: '13px', color: '#7f8c8d', margin: '8px 0 0', maxHeight: '60px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      <small>Details: {item.document}</small>
    </p>
    {item.distance && (
        <p style={{ fontSize: '12px', color: '#95a5a6', margin: '4px 0 0' }}>
            <small>Relevance (distance): {item.distance.toFixed(4)}</small>
        </p>
    )}
  </Card>
);

const UserCard = ({ user, onAddFriend, requestStatus, loading }) => (
  <Card style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
    <Avatar photoUrl={user.profile_photo_url} name={user.first_name || user.username} size={50} />
    <div style={{ flexGrow: 1 }}>
      <Link to={`/profile/${user.username}`} style={{ textDecoration: 'none' }}>
        <h4 style={{ margin: 0, color: '#3498db', fontSize: '17px' }}>
          {user.first_name} {user.last_name || ''}
        </h4>
      </Link>
      <p style={{ margin: '2px 0', fontSize: '14px', color: '#7f8c8d' }}>@{user.username}</p>
      {user.affiliation && (
        <p style={{ margin: '2px 0', fontSize: '13px', color: '#95a5a6' }}>{user.affiliation}</p>
      )}
    </div>
    {onAddFriend && ( 
      <button
        onClick={() => onAddFriend(user.id)}
        disabled={loading || ['sending', 'sent'].includes(requestStatus[user.id])}
        style={{
          padding: '8px 16px',
          backgroundColor: requestStatus[user.id] === 'sent' ? '#2ecc71' : '#3498db',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: (loading || ['sending', 'sent'].includes(requestStatus[user.id])) ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          opacity: (loading || ['sending', 'sent'].includes(requestStatus[user.id])) ? 0.7 : 1,
        }}
      >
        {requestStatus[user.id] === 'sending' ? 'Sending...' :
         requestStatus[user.id] === 'sent' ? '✓ Sent' :
         requestStatus[user.id] === 'error' ? 'Retry' : 'Add Friend'}
      </button>
    )}
  </Card>
);

const PostCard = ({ post, type }) => { 
  const getPostLink = () => {
    if (type === 'bluesky') return `https://bsky.app/profile/${post.author_did}/post/${post.bluesky_id.split('/').pop()}`;
    if (type === 'federated' && post.source_site && post.post_uuid_within_site) {
        return `https://${post.source_site}/posts/${post.post_uuid_within_site}`;
    }
    return '#'; 
  };

  const imageEmbed = type === 'bluesky' ? post.embded_image_json : (post.attach_url ? { images: [{ image: { ref: { link: post.attach_url }}, alt: 'Attachment'}] } : null) ;
  const image = imageEmbed?.images?.[0];
  let imageUrl = image?.image?.ref?.link;
  if (type === 'bluesky' && image?.image?.type === 'blob' && image?.image?.ref?.link) {
      imageUrl = `https://cdn.bsky.app/img/feed_fullsize/plain/${post.author_did}/${image.image.ref.link}@${image.image.mimeType.split('/')[1]}`;
  } else if (type === 'federated' && post.attach_url) {
      imageUrl = post.attach_url;
  }


  return (
    <Card style={{ marginBottom: '15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <Avatar name={post.username || post.author_did} size={36} />
        <div>
          <a href={getPostLink()} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <h5 style={{ margin: 0, color: '#2c3e50', fontSize: '15px' }}>
              {post.username || post.author_did}
            </h5>
          </a>
          <p style={{ margin: '2px 0', fontSize: '12px', color: '#7f8c8d' }}>
            {new Date(post.created_at).toLocaleString()}
            {type === 'federated' && ` via ${post.source_site}`}
          </p>
        </div>
      </div>
      <p style={{ fontSize: '14px', color: '#34495e', lineHeight: 1.6, margin: '0 0 10px 0', whiteSpace: 'pre-wrap' }}>
        {post.content || post.post_text}
      </p>
      {imageUrl && (
        <a href={getPostLink()} target="_blank" rel="noopener noreferrer">
            <img
                src={imageUrl}
                alt={image?.alt || "Post image"}
                style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', borderRadius: '8px', marginTop: '10px' }}
            />
        </a>
      )}
      {type === 'bluesky' && (
        <div style={{ display: 'flex', gap: '15px', marginTop: '10px', fontSize: '13px', color: '#7f8c8d' }}>
          <span>Likes: {post.like_count || 0}</span>
          <span>Reposts: {post.repost_count || 0}</span>
          <span>Replies: {post.reply_count || 0}</span>
        </div>
      )}
    </Card>
  );
};

const ChatbotPage = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [toast, setToast] = useState({ message: '', type: '', show: false });
  const [requestStatus, setRequestStatus] = useState({});

  const showToast = (message, type = 'error') => {
    setToast({ message, type, show: true });
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) {
      showToast('Please enter something to search.');
      return;
    }
    setLoading(true);
    setResponse(null);
    try {
      const { data } = await axios.post('/api/chatbot/search', { query });
      setResponse(data);
      if (!data.ai_summary && !data.retrieved_actor_movie_info?.length && !data.retrieved_users?.length && !data.retrieved_federated_posts?.length && !data.retrieved_bluesky_posts?.length) {
        showToast('No results found for your query.', 'info');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'An unexpected error occurred. Please try again.';
      showToast(errorMessage);
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFriendRequest = async (recipientId) => {
    if (!recipientId) return;
    setRequestStatus(prev => ({ ...prev, [recipientId]: 'sending' }));
    try {
      await axios.post('/api/friendships/request', { recipientId });
      setRequestStatus(prev => ({ ...prev, [recipientId]: 'sent' }));
      showToast('Friend request sent!', 'success');
    } catch (err) {
      setRequestStatus(prev => ({ ...prev, [recipientId]: 'error' }));
      showToast(err.response?.data?.error || 'Failed to send friend request.', 'error');
    }
  };

  return (
    <div style={{
      maxWidth: '900px',
      margin: '30px auto',
      padding: '30px',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      backgroundColor: '#f4f7f6',
      minHeight: '100vh'
    }}>
      {toast.show && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(prev => ({ ...prev, show: false }))} />}

      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ margin: '0 0 10px 0', fontSize: '32px', color: '#2c3e50', fontWeight: '600' }}>
          Universal Search Assistant
        </h1>
        <p style={{ margin: 0, color: '#7f8c8d', fontSize: '16px' }}>
          Explore actors, movies, users, and posts from across platforms.
        </p>
      </header>

      <form onSubmit={handleSearch} style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', gap: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', borderRadius: '8px' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for anything..."
            style={{
              flexGrow: 1,
              padding: '15px 20px',
              fontSize: '16px',
              border: '1px solid #dfe6e9',
              borderRadius: '8px 0 0 8px',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = '#3498db'}
            onBlur={e => e.target.style.borderColor = '#dfe6e9'}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '15px 30px',
              fontSize: '16px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '0 8px 8px 0',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              transition: 'background-color 0.2s',
              opacity: loading ? 0.7 : 1,
            }}
            onMouseOver={e => !loading && (e.currentTarget.style.backgroundColor = '#2980b9')}
            onMouseOut={e => !loading && (e.currentTarget.style.backgroundColor = '#3498db')}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {loading && (
        <div style={{ textAlign: 'center', padding: '30px', color: '#7f8c8d' }}>
          <div style={{ // Simple spinner
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3498db',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 15px auto'
          }}></div>
          Fetching results...
          {/* css for spinner animation */}
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {response && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {response.ai_summary && (
            <section>
              <h2 style={{ borderBottom: '2px solid #3498db', paddingBottom: '10px', marginBottom: '15px', color: '#2c3e50', fontSize: '22px' }}>
                ✨ AI Summary
              </h2>
              <Card style={{ backgroundColor: '#eaf5ff' }}>
                <p style={{ margin: 0, lineHeight: 1.7, color: '#34495e', fontSize: '15px' }}>
                  {response.ai_summary}
                </p>
              </Card>
            </section>
          )}

          {response.retrieved_actor_movie_info?.length > 0 && (
            <section>
              <h2 style={{ borderBottom: '2px solid #e74c3c', paddingBottom: '10px', marginBottom: '15px', color: '#2c3e50', fontSize: '22px' }}>
                🎞️ Actors & Movies
              </h2>
              {response.retrieved_actor_movie_info.map((item, index) => (
                <ActorMovieCard key={item.id || `actor-${index}`} item={item} />
              ))}
            </section>
          )}

          {response.retrieved_users?.length > 0 && (
            <section>
              <h2 style={{ borderBottom: '2px solid #2ecc71', paddingBottom: '10px', marginBottom: '15px', color: '#2c3e50', fontSize: '22px' }}>
                👥 Platform Users
              </h2>
              {response.retrieved_users.map((user, index) => (
                <UserCard
                  key={user.id || `user-${index}`}
                  user={user}
                  onAddFriend={handleFriendRequest}
                  requestStatus={requestStatus}
                  loading={requestStatus[user.id] ==='sending'}
                />
              ))}
            </section>
          )}

          {response.retrieved_federated_posts?.length > 0 && (
            <section>
              <h2 style={{ borderBottom: '2px solid #f39c12', paddingBottom: '10px', marginBottom: '15px', color: '#2c3e50', fontSize: '22px' }}>
                🌐 Federated Posts
              </h2>
              {response.retrieved_federated_posts.map((post, index) => (
                <PostCard key={post.federated_id || `fedpost-${index}`} post={post} type="federated" />
              ))}
            </section>
          )}

          {response.retrieved_bluesky_posts?.length > 0 && (
            <section>
              <h2 style={{ borderBottom: '2px solid #9b59b6', paddingBottom: '10px', marginBottom: '15px', color: '#2c3e50', fontSize: '22px' }}>
                🦋 Bluesky Posts
              </h2>
              {response.retrieved_bluesky_posts.map((post, index) => (
                <PostCard key={post.bluesky_id || `bskypost-${index}`} post={post} type="bluesky" />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatbotPage;