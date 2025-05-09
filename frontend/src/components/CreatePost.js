import React, { useState } from 'react';
import axios from 'axios';

function CreatePost({ user }) {
  const [postText, setPostText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');

    if (!postText.trim() && !imageUrl.trim()) {
      setError('Please provide either text or an image URL.');
      return;
    }

    setIsSubmitting(true);
    try {
      const hashtagArray = hashtags.split(',').map(tag => tag.trim()).filter(tag => tag);

      await axios.post('/api/posts/federated', {
        post_json: {
          username: user.username,
          source_site: '2y2b',
          post_uuid_within_site: crypto.randomUUID(),
          post_text: postText,
          content_type: 'text/plain',
          hashtags: hashtagArray
        },
        attach: imageUrl
      });
      setSuccess('Post created!');
      setPostText('');
      setImageUrl('');
      setHashtags('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create post.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      maxWidth: '500px',
      margin: '40px auto',
      padding: '24px',
      backgroundColor: '#fff',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      borderRadius: '12px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h2 style={{
        marginBottom: '16px',
        fontSize: '24px',
        color: '#333',
        textAlign: 'center'
      }}>
        Create a New Post
      </h2>

      {success && (
        <div style={{
          marginBottom: '12px',
          padding: '10px',
          borderRadius: '6px',
          backgroundColor: '#e6ffed',
          color: '#2d7a2d',
          textAlign: 'center'
        }}>
          {success}
        </div>
      )}
      {error && (
        <div style={{
          marginBottom: '12px',
          padding: '10px',
          borderRadius: '6px',
          backgroundColor: '#ffe6e6',
          color: '#a12d2d',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <textarea
          value={postText}
          onChange={e => setPostText(e.target.value)}
          placeholder="What's on your mind?"
          rows={4}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #ccc',
            fontSize: '14px',
            resize: 'vertical',
            fontFamily: 'inherit'
          }}
        />

        <input
          type="text"
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          placeholder="Image URL"
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #ccc',
            fontSize: '14px',
            fontFamily: 'inherit'
          }}
        />

        <input
          type="text"
          value={hashtags}
          onChange={e => setHashtags(e.target.value)}
          placeholder="Hashtags (comma-separated)"
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #ccc',
            fontSize: '14px',
            fontFamily: 'inherit'
          }}
        />

        <button
          type="submit"
          disabled={isSubmitting || (!postText.trim() && !imageUrl.trim())}
          style={{
            padding: '12px',
            fontSize: '16px',
            fontWeight: '600',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: isSubmitting || (!postText.trim() && !imageUrl.trim())
              ? '#ccc'
              : '#4a90e2',
            color: '#fff',
            cursor: isSubmitting || (!postText.trim() && !imageUrl.trim())
              ? 'not-allowed'
              : 'pointer',
            transition: 'background-color 0.2s ease-in-out'
          }}
        >
          {isSubmitting ? 'Posting...' : 'Post'}
        </button>
      </form>
    </div>
  );
}

export default CreatePost;