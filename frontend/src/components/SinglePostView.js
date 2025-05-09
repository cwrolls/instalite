import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import PostCard from './PostCard';
import { useGlobalToasts } from '../contexts/ToastContext';

export default function SinglePostView({ user }) {
  const { postid } = useParams(); 
  const { addToast } = useGlobalToasts();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPost = async () => {
    const [source, id] = postid.split('-', 2);
  
    let endpoint;
    if (source === 'federated') {
      endpoint = `/api/postinfo/federated/${id}`;
    } else if (source === 'bluesky') {
      endpoint = `/api/postinfo/bluesky/${id}`;
    } else {
      endpoint = `/api/postinfo/${id}`;
    }
  
    const res = await axios.get(endpoint);
    setPost(res.data);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchPost();
      setLoading(false);
    })();
  }, [postid]);

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#555' }}>
        Loading post...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'red' }}>
        <h2>Error</h2>
        <p>{error}</p>
        <Link to="/" style={{ color: '#007bff' }}>Return Home</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
      {post && user && (
        <PostCard post={post} user={user} />
      )}
      <Link to="/" style={{ display: 'block', textAlign: 'center', marginTop: '20px', color: '#007bff' }}>
        ← Back to Home
      </Link>
    </div>
  );
}
