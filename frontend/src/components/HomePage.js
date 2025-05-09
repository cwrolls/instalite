import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import PostCard from './PostCard';
import { useGlobalToasts } from '../contexts/ToastContext';

const POSTS_PER_PAGE = 20;

export default function HomePage({ user }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const { addToast } = useGlobalToasts();

  const fetchPosts = useCallback(async (pageNum) => {
    if (!hasMore && pageNum > 1) return;
    
    setLoadingMore(true);
    if (pageNum === 1) {
      setLoading(true);
    }

    try {
      const response = await axios.get(`/api/feed?page=${pageNum}&limit=${POSTS_PER_PAGE}`);
      const newPosts = response.data;

      setPosts(prevPosts => pageNum === 1 ? newPosts : [...prevPosts, ...newPosts]);
      if (newPosts.length > 0 || pageNum === 1) {
        setPage(pageNum);
      }
      setHasMore(newPosts.length > 0);

    } catch (err) {
      console.error("Failed to fetch posts:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [hasMore]);

  useEffect(() => {


    // addToast({
    //   title: (
    //     <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    //       <img 
    //         src="https://example.com/path-to-profile-pic.jpg" 
    //         alt="Profile" 
    //         style={{ width: '32px', height: '32px', borderRadius: '50%' }} 
    //       />
    //       <span style={{ fontWeight: '600' }}>john_doe</span>
    //     </div>
    //   ),
    //   content: "Hey! Are you free for a quick call?",
    //   type: 'info',
    //   duration: 20000,
    //   viewLink: '/chat/john_doe',
    //   viewText: 'Reply'
    // });

    fetchPosts(1);
  }, [fetchPosts]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 200) {
        if (hasMore && !loadingMore) {
          fetchPosts(page + 1);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadingMore, hasMore, page, fetchPosts]);

  if (loading && page === 1) {
    return (
      <div style={{
        textAlign:'center', padding:40, color:'#888'
      }}>
        Loading feed...
      </div>
    );
  }

  return (
    <div style={{
      maxWidth:600, margin:'0 auto',
      backgroundColor:'#fafafa', paddingTop:20,
      fontFamily:'Arial, sans-serif'
    }}>
      <h1 style={{
        marginBottom:'10px', color:'#333',
        fontSize:'28px', fontWeight:'bold',
        textTransform:'uppercase'
      }}>
        Home Feed
      </h1>

      {posts.map(post => (
        <PostCard key={post.id} post={post} user={user}/>
      ))}

      {loadingMore && (
        <div style={{ textAlign: 'center', padding: 20, color: '#888' }}>
          Loading more posts...
        </div>
      )}

      {!loadingMore && !hasMore && posts.length > 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: '#888' }}>
          No more posts to load.
        </div>
      )}
    </div>
  );
}