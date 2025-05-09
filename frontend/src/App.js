import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import io from 'socket.io-client';

import { GlobalToastProvider, useGlobalToasts } from './contexts/ToastContext';

import Chatbot from './components/Chatbot';
import ChatComponent from './components/ChatComponent';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import HomePage from './components/HomePage';
import ProfilePage from './components/ProfilePage';
import FriendsPage from './components/FriendsPage';
import CreatePost from './components/CreatePost';
import SinglePostView from './components/SinglePostView';

import './App.css'; 
import axios from 'axios';

axios.defaults.baseURL = process.env.REACT_APP_API_BASE_URL || '/';
axios.defaults.withCredentials = true;

const backendSocketUrl = process.env.REACT_APP_SOCKET_URL || (process.env.REACT_APP_API_BASE_URL ? new URL(process.env.REACT_APP_API_BASE_URL).origin : window.location.origin);


function AppContent() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const { addToast } = useGlobalToasts();

  const presenceSocketRef = useRef(null);

  const checkSession = useCallback(async () => {
    console.log("Checking for active session...");
    setLoadingAuth(true);
    try {
      const response = await axios.get('/api/auth/session');
      if (response.data && response.data.user) {
        setCurrentUser(response.data.user);
      } else {
        setCurrentUser(null);
      }
    } catch (error) {
      setCurrentUser(null);
    } finally {
      setLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (currentUser && currentUser.userId) {
        if (presenceSocketRef.current?.connected) {
            if (presenceSocketRef.current.auth?.userId !== currentUser.userId) {
                 console.log("[Presence Client] User ID changed, re-connecting presence socket.");
                 presenceSocketRef.current.disconnect();
                 presenceSocketRef.current = null; 
            } else {
                return;
            }
        }
        
        if (!presenceSocketRef.current) {
            console.log(`[Presence Client] Attempting to connect to /presence for user ${currentUser.username} (ID: ${currentUser.userId})`);
            const socket = io(`${backendSocketUrl}/presence`, {
                reconnectionAttempts: 5,
                withCredentials: true,
                auth: { userId: currentUser.userId }
            });
            presenceSocketRef.current = socket;

            socket.on('connect', () => {
                console.log(`[Presence Client] Connected to /presence namespace with ID: ${socket.id}`);
            });

            socket.on('disconnect', (reason) => {
                console.log(`[Presence Client] Disconnected from /presence: ${reason}`);
            });

            socket.on('connect_error', (err) => {
                console.error(`[Presence Client] Connection Error to /presence: ${err.message} - ${err.data?.message}`);
                addToast({ title: "Connection Issue", content: "Could not connect to real-time presence service.", type: 'error', duration: 7000 });
            });

            socket.on('showGlobalToast', (toastData) => {
                console.log('[Presence Client] Received global toast from server:', toastData);
                addToast(toastData);
            });

            socket.on('globalUserOnline', (userData) => {
                console.log('[Presence Client] Global user came online:', userData.username);
            });
            socket.on('globalUserOffline', ({ userId }) => {
                console.log('[Presence Client] Global user went offline:', userId);
            });
        }

        return () => {
            if (presenceSocketRef.current && (!currentUser || presenceSocketRef.current.auth?.userId === currentUser.userId)) {
                 console.log("[Presence Client] Cleaning up presence socket connection.");
                 presenceSocketRef.current.disconnect();
                 presenceSocketRef.current = null;
            }
        };
    } else {
        if (presenceSocketRef.current) {
            console.log("[Presence Client] No user logged in, ensuring presence socket is disconnected.");
            presenceSocketRef.current.disconnect();
            presenceSocketRef.current = null;
        }
    }
  }, [currentUser, addToast]);

  const handleAuthSuccess = (userData) => {
    setCurrentUser(userData);
    addToast({ title: 'Welcome Back!', content: `Successfully logged in as ${userData.username}.`, type: 'success' });
  };

  const handleLogout = async () => {
    if (presenceSocketRef.current) {
        console.log("[Presence Client] Disconnecting presence socket due to logout.");
        presenceSocketRef.current.disconnect();
        presenceSocketRef.current = null;
    }
    try {
        await axios.post('/api/auth/logout');
        addToast({ content: 'You have been logged out.', type: 'info' });
    } catch (error) {
        addToast({ content: 'Logout failed. Please try again.', type: 'error' });
    } finally {
        setCurrentUser(null);
    }
  };

  if (loadingAuth) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '1.2em', color: '#555' }}>
            <p>Loading InstaLite...</p>
         </div>
        );
  }

  const renderAvatar = (user, size = 30) => {
      const style = {
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          border: '1px solid #dbdbdb',
          display: 'inline-block',
          verticalAlign: 'middle',
          objectFit: 'cover', 
          backgroundColor: '#eee' 
      };
      if (user?.profilePhotoUrl) { 
          return <img src={user.profilePhotoUrl} alt={user.username} style={style} />;
      } else {
          const initial = user?.username ? user.username.charAt(0).toUpperCase() : '?';
          return (
              <div style={{
                  ...style,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: `${size * 0.6}px`, 
                  color: '#555'
              }}>
                  {initial}
              </div>
          );
      }
  };

  return (
    
      <div className="app">
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 24px',
          backgroundColor: '#fff',
          borderBottom: '1px solid #dbdbdb',
          position: 'sticky',
          top: 0,
          zIndex: 1000, 
        }}
      >
         <h1 style={{ margin: 0 }}>
            <Link
              to="/"
              style={{
                textDecoration: 'none',
                fontSize: '1.8rem',
                fontWeight: 'bold',
                fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                color: '#262626',
              }}
            >
              InstaLite
            </Link>
          </h1>
          <nav>
            <ul
              style={{
                listStyle: 'none',
                display: 'flex',
                alignItems: 'center',
                margin: 0,
                padding: 0,
                gap: '20px',
                fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
              }}
            >
              {currentUser ? (
                <>
                  <li><Link to="/" style={{ textDecoration: 'none', color: '#262626' }}>Home</Link></li>
                  <li><Link to="/profile" style={{ textDecoration: 'none', color: '#262626' }}>Profile</Link></li>
                  <li><Link to="/create-post" style={{ textDecoration: 'none', color: '#262626' }}>Create</Link></li>
                  <li><Link to="/friends" style={{ textDecoration: 'none', color: '#262626' }}>Friends</Link></li>
                  <li><Link to="/chat" style={{ textDecoration: 'none', color: '#262626' }}>Chat</Link></li>
                  <li><Link to="/search" style={{ textDecoration: 'none', color: '#262626' }}>Search</Link></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f9f9f9', padding: '6px 10px', borderRadius: '30px', border: '1px solid #dbdbdb', }}>
                    <span>{renderAvatar(currentUser, 24)}</span>
                    <span style={{ fontSize: '0.9rem', color: '#555' }}>{currentUser.username}</span>
                    <button onClick={handleLogout} style={{ marginLeft: '6px', backgroundColor: '#efefef', border: 'none', borderRadius: '20px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem', color: '#262626', transition: 'background-color 0.2s', }} onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#e0e0e0')} onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#efefef')} >
                      Logout
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li><Link to="/login" style={{ textDecoration: 'none', color: '#262626' }}>Login</Link></li>
                  <li><Link to="/signup" style={{ textDecoration: 'none', color: '#262626' }}>Sign Up</Link></li>
                </>
              )}
            </ul>
          </nav>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/login" element={!currentUser ? <LoginPage onLoginSuccess={handleAuthSuccess} /> : <Navigate to="/" replace />} />
            <Route path="/signup" element={!currentUser ? <SignupPage onLoginSuccess={handleAuthSuccess} /> : <Navigate to="/" replace />} />
            <Route path="/" element={currentUser ? <HomePage user={currentUser} /> : <Navigate to="/login" replace />} />
            <Route path="/profile/:id?" element={currentUser ? <ProfilePage user={currentUser} onProfileUpdate={checkSession} /> : <Navigate to="/login" replace />} />
            <Route path="/posts/:postid" element={currentUser? <SinglePostView user={currentUser} /> : <Navigate to="/login" replace />} />
            <Route path="/friends" element={currentUser ? <FriendsPage user={currentUser} /> : <Navigate to="/login" replace />} />
            <Route path="/chat" element={currentUser ? <ChatComponent user={currentUser} /> : <Navigate to="/login" replace />} />
            <Route path="/search" element={currentUser ? <Chatbot user={currentUser} /> : <Navigate to="/login" replace />} />
            <Route path="/create-post" element={currentUser ? <CreatePost user={currentUser} /> : <Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to={currentUser ? "/" : "/login"} replace />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <p>© {new Date().getFullYear()} InstaLite - NETS 2120 Project</p>
        </footer>
      </div>
  );
}

function App() {
  return (
    <Router>
    <GlobalToastProvider>
      <AppContent />
    </GlobalToastProvider>
    </Router>
  );
}

export default App;