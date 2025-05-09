import React, { useState, useEffect } from 'react';
import axios from 'axios';



function Posts() {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  // toggle like
  const handleLike = async (postId) => {
    console.log("handleLike called")
    console.log(`Toggling like for post ${postId}`);
    try {
      const response = await axios.post(`/api/feed/${postId}/like`);
      
      if (response.data.success) {
        console.log("like sent!")
        setPosts(currentPosts => 
          currentPosts.map(post => {
            if (post.post_id === postId) {
              return { 
                ...post, 
                user_has_liked: response.data.liked, 
                likes_count: response.data.newLikeCount 
              };
            }
            return post;
          })
        );
      } else {
          console.error("Failed to toggle like (API success false):". response.data);
      }
    } catch (error) {
      console.error('Error toggling like:', error.response ? error.response.data : error.message);
    }
  };

  /* 
  const handlePost = async () => {
    setIsPosting(true);
    try {
      await postFederatedMessage({
        content: newPost,
        timestamp: new Date().toISOString(),  
      });
      setNewPost('');
    } catch (error) {
      console.error('Error posting:', error);
    } finally {
      setIsPosting(false);
    }
  };
  */

  return (
    <div>
      
      <div className="posts-container">
        <h2>Feed</h2>
        {posts.length === 0 ? (
          <p>No posts to display.</p>
        ) : (
          posts.map((post) => (
            <div key={post.post_id} className="post">
              <div className="post-header">
                <img 
                  src={post.author?.profile_photo_url || '/default-avatar.png'}
                  alt={`${post.author?.username || 'Unknown'}'s avatar`} 
                  className="avatar"
                />
                <span className="username">{post.author?.username || 'Unknown User'}</span>
                <span className="timestamp">{new Date(post.created_at).toLocaleString()}</span>
              </div>
              <div className="post-content">{post.content}</div>
              <div className="post-actions">
                <button 
                  className={`like-button ${post.user_has_liked ? 'liked' : ''}`}
                  onClick={() => handleLike(post.post_id)}
                >
                  {post.user_has_liked ? 'Liked' : 'Like'} ({post.likes_count})
                </button>
                <button className="comment-button">
                  Comments ({post.comments_count})
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Posts;

