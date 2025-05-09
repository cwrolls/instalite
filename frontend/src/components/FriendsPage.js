import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useGlobalToasts } from '../contexts/ToastContext';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, children }) => {
    if (!isOpen) return null;
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 2000,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}>
            <div style={{
                backgroundColor: '#ffffff', padding: '25px 30px', borderRadius: '10px',
                boxShadow: '0 6px 20px rgba(0,0,0,0.25)', width: 'auto',
                maxWidth: '420px', textAlign: 'center',
            }}>
                <h3 style={{ marginTop: 0, marginBottom: '18px', fontSize: '1.3em', color: '#333', fontWeight: 600 }}>{title}</h3>
                <div style={{ marginBottom: '28px', fontSize: '1em', color: '#555', lineHeight: '1.5' }}>
                    {children}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                        onClick={onClose}
                        style={{ padding: '9px 18px', borderRadius: '7px', border: '1px solid #ced4da', backgroundColor: '#f8f9fa', color: '#343a40', cursor: 'pointer', fontSize: '0.9em', fontWeight: '500', transition: 'background-color 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e9ecef'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    >Cancel</button>
                    <button
                        onClick={onConfirm}
                        style={{ padding: '9px 18px', borderRadius: '7px', border: 'none', backgroundColor: '#dc3545', color: 'white', cursor: 'pointer', fontSize: '0.9em', fontWeight: '500', transition: 'background-color 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#c82333'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#dc3545'}
                    >Confirm</button>
                </div>
            </div>
        </div>
    );
};


function FriendsPage({ user }) {
    const { addToast } = useGlobalToasts(); 
    const [friends, setFriends] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [onlineFriendIds, setOnlineFriendIds] = useState(new Set());
    const [loadingFriends, setLoadingFriends] = useState(false);
    const [loadingRequests, setLoadingRequests] = useState(false);
    const [loadingOnlineStatus, setLoadingOnlineStatus] = useState(false);
    const [recommendations, setRecommendations] = useState([]);
    const [loadingRecommendations, setLoadingRecommendations] = useState(false);

    const [showUnfriendConfirmModal, setShowUnfriendConfirmModal] = useState(false);
    const [friendToUnfriendDetails, setFriendToUnfriendDetails] = useState(null);

    const renderAvatar = (itemUser, size = 40, isOnline = false) => {
        const baseStyle = {
            width: `${size}px`, height: `${size}px`, borderRadius: '50%',
            border: '1px solid #eee', display: 'inline-block', verticalAlign: 'middle',
            objectFit: 'cover', backgroundColor: '#f0f0f0', marginRight: '10px',
            position: 'relative',
        };
        const onlineIndicatorStyle = {
            position: 'absolute', bottom: '0px', right: '0px',
            width: `${size * 0.3}px`, height: `${size * 0.3}px`,
            borderRadius: '50%', backgroundColor: '#4CAF50',
            border: '2px solid white',
            boxSizing: 'border-box',
        };

        let avatarContent;
        if (itemUser?.profile_photo_url) {
            avatarContent = <img src={itemUser.profile_photo_url} alt={itemUser.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />;
        } else {
            const initial = itemUser?.username ? itemUser.username.charAt(0).toUpperCase() : '?';
            avatarContent = (
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: `${size * 0.5}px`, color: '#888', backgroundColor: '#f0f0f0' }}>
                    {initial}
                </div>
            );
        }

        return (
            <div style={baseStyle}>
                {avatarContent}
                {isOnline && <div style={onlineIndicatorStyle} title="Online"></div>}
            </div>
        );
    };


    // fetch accepted friends
    const fetchFriends = useCallback(async () => {
        if (!user) return;
        setLoadingFriends(true);
        try {
            const response = await axios.get(`/api/friendships/`);
            setFriends(response.data.friends || []);
        } catch (err) {
            console.error('Error fetching friends:', err);
            addToast({
                title: "Error",
                content: `Error fetching friends: ${err.response?.data?.error || err.message}`,
                type: 'error'
            });
            setFriends([]);
        } finally {
            setLoadingFriends(false);
        }
    }, [user, addToast]);

    // fetch pending incoming reqs
    const fetchPendingRequests = useCallback(async () => {
        if (!user) return;
        setLoadingRequests(true);
        try {
            const response = await axios.get(`/api/friendships/pending/incoming`);
            setPendingRequests(response.data.pendingRequests || []);
        } catch (err) {
            console.error('Error fetching pending requests:', err);
            addToast({
                title: "Error",
                content: `Error fetching requests: ${err.response?.data?.error || err.message}`,
                type: 'error'
            });
            setPendingRequests([]);
        } finally {
            setLoadingRequests(false);
        }
    }, [user, addToast]);

    // fetch online users list
    const fetchOnlineUsers = useCallback(async () => {
        setLoadingOnlineStatus(true);
        try {
            const response = await axios.get('/api/presence/online-users');
            setOnlineFriendIds(new Set(response.data.onlineUserIds || []));
        } catch (err) {
            console.error("Error fetching online users:", err);
            setOnlineFriendIds(new Set());
        } finally {
            setLoadingOnlineStatus(false);
        }
    }, []);

    const fetchRecommendations = useCallback(async () => {
        if (!user) return;
        setLoadingRecommendations(true);
        try {
            const response = await axios.get('/api/friendships/recommendations');
            setRecommendations(response.data.recommendations || []);
        } catch (err) {
            console.error('Error fetching recommendations:', err);
            addToast({
                title: "Error",
                content: `Error fetching recommendations: ${err.response?.data?.error || err.message}`,
                type: 'error'
            });
            setRecommendations([]);
        } finally {
            setLoadingRecommendations(false);
        }
    }, [user, addToast]);

    useEffect(() => {
        fetchFriends();
        fetchPendingRequests();
        fetchOnlineUsers();
        fetchRecommendations();
    }, [fetchFriends, fetchPendingRequests, fetchOnlineUsers, fetchRecommendations]);

    const handleAcceptRequest = async (friendshipId) => {
        try {
            await axios.post('/api/friendships/accept', { friendshipId });
            addToast({ content: 'Friend request accepted!', type: 'success' });
            fetchFriends(); 
            fetchPendingRequests(); 
            fetchOnlineUsers();
        } catch (err) {
            console.error('Error accepting request:', err);
            addToast({
                title: "Accept Failed",
                content: `Accept failed: ${err.response?.data?.error || err.message}`,
                type: 'error'
            });
        }
    };

    const handleRejectRequest = async (friendshipId) => {
        try {
            await axios.post('/api/friendships/reject', { friendshipId });
            addToast({ content: 'Friend request rejected.', type: 'info' });
            fetchPendingRequests(); 
        } catch (err) {
            console.error('Error rejecting request:', err);
            addToast({
                title: "Reject Failed",
                content: `Reject failed: ${err.response?.data?.error || err.message}`,
                type: 'error'
            });
        }
    };

    const triggerUnfriendModal = (friendUserId, friendUsername) => {
        setFriendToUnfriendDetails({ userId: friendUserId, username: friendUsername });
        setShowUnfriendConfirmModal(true);
    };

    const confirmUnfriend = async () => {
        if (!friendToUnfriendDetails) return;
        const { userId: friendUserId, username: friendUsername } = friendToUnfriendDetails;
        setShowUnfriendConfirmModal(false);

        try {
            await axios.delete(`/api/friendships/${friendUserId}`);
            addToast({ content: `Unfriended ${friendUsername || 'friend'}.`, type: 'info' });
            setFriendToUnfriendDetails(null);
            fetchFriends();
        } catch (err) {
            console.error('Error unfriending:', err);
            addToast({
                title: "Unfriend Failed",
                content: `Unfriend failed: ${err.response?.data?.error || err.message}`,
                type: 'error'
            });
            setFriendToUnfriendDetails(null);
        }
    };

    const handleSendFriendRequest = async (recipientId, recipientUsername) => {
        try {
            await axios.post('/api/friendships/request', { recipientId });
            addToast({
                title: "Request Sent",
                content: `Friend request sent to ${recipientUsername || 'user'}.`,
                type: 'success'
            });
            setRecommendations(prev => prev.filter(rec => rec.user_id !== recipientId));
        } catch (err) {
            console.error('Error sending friend request:', err);
            addToast({
                title: "Request Failed",
                content: `Failed to send request: ${err.response?.data?.error || err.message}`,
                type: 'error'
            });
        }
    };


    const styles = {
        container: { padding: '20px', maxWidth: '800px', margin: '30px auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
        section: { marginBottom: '30px', border: '1px solid #e0e0e0', padding: '20px', borderRadius: '8px', background: '#ffffff', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' },
        heading: { marginTop: 0, marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px', fontSize: '1.4em', color: '#333', fontWeight: 600 },
        list: { listStyle: 'none', padding: 0, margin: 0 },
        listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0', gap: '15px' },
        userInfo: { display: 'flex', alignItems: 'center', flexGrow: 1, minWidth: 0, overflow: 'hidden' },
        userDetails: { display: 'flex', flexDirection: 'column', marginLeft: '5px', overflow: 'hidden' },
        actions: { display: 'flex', gap: '10px', flexShrink: 0 },
        button: { padding: '6px 12px', cursor: 'pointer', borderRadius: '5px', border: '1px solid transparent', fontSize: '0.85em', fontWeight: 500, transition: 'all 0.2s ease' },
        acceptButton: { backgroundColor: '#5cb85c', color: 'white', borderColor: '#4cae4c', '&:hover': { backgroundColor: '#449d44' } },
        rejectButton: { backgroundColor: '#d9534f', color: 'white', borderColor: '#d43f3a', '&:hover': { backgroundColor: '#c9302c' } },
        unfriendButton: { backgroundColor: '#f0ad4e', color: 'white', borderColor: '#eea236', '&:hover': { backgroundColor: '#ec971f' } },
        addFriendButton: { backgroundColor: '#17a2b8', color: 'white', borderColor: '#17a2b8', '&:hover': { backgroundColor: '#138496' } },
        profileLink: { textDecoration: 'none', color: '#007bff', fontWeight: 'bold', '&:hover': { textDecoration: 'underline' } },
        fullName: { fontSize: '0.9em', color: '#666', marginTop: '2px' },
        loading: { color: '#777', fontStyle: 'italic' },
        noItems: { color: '#777', marginTop: '10px' },
        listHeader: { fontWeight: 'bold', color: '#555', marginBottom: '10px', marginTop: '20px', fontSize: '1.1em' },
    };
    const { onlineFriends, offlineFriends } = useMemo(() => {
        const online = [];
        const offline = [];
        friends.forEach(friend => {
            if (onlineFriendIds.has(friend.user_id)) {
                online.push(friend);
            } else {
                offline.push(friend);
            }
        });
        const sortFn = (a, b) => (a.username || '').localeCompare(b.username || '');
        online.sort(sortFn);
        offline.sort(sortFn);
        return { onlineFriends: online, offlineFriends: offline };
    }, [friends, onlineFriendIds]);


    return (
        <div style={styles.container}>
            <ConfirmationModal
                isOpen={showUnfriendConfirmModal}
                onClose={() => { setShowUnfriendConfirmModal(false); setFriendToUnfriendDetails(null); }}
                onConfirm={confirmUnfriend}
                title="Confirm Unfriend"
            >
                <p>Are you sure you want to remove <strong>{friendToUnfriendDetails?.username || 'this friend'}</strong>?</p>
            </ConfirmationModal>

            <h1 style={{ marginBottom: '25px', textAlign: 'center', color: '#444' }}>Manage Friends</h1>

            <div style={styles.section}>
                <h3 style={styles.heading}>Pending Friend Requests ({pendingRequests.length})</h3>
                {loadingRequests ? (<p style={styles.loading}>Loading requests...</p>) : (
                    pendingRequests.length === 0 ? (<p style={styles.noItems}>No incoming friend requests.</p>) : (
                        <ul style={styles.list}>
                            {pendingRequests.map(req => (
                                <li key={req.friendshipId} style={styles.listItem}>
                                    <div style={styles.userInfo}>
                                        {renderAvatar(req.sender, 40, onlineFriendIds.has(req.sender.userId))}
                                        <div style={styles.userDetails}>
                                            <Link to={`/profile/${req.sender.username}`} style={styles.profileLink}>{req.sender.username}</Link>
                                            <span style={styles.fullName}>({req.sender.firstName} {req.sender.lastName})</span>
                                        </div>
                                    </div>
                                    <div style={styles.actions}>
                                        <button onClick={() => handleAcceptRequest(req.friendshipId)} style={{ ...styles.button, ...styles.acceptButton }}>Accept</button>
                                        <button onClick={() => handleRejectRequest(req.friendshipId)} style={{ ...styles.button, ...styles.rejectButton }}>Reject</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )
                )}
            </div>

            <div style={styles.section}>
                <h3 style={styles.heading}>People You May Know ({recommendations.length})</h3>
                {loadingRecommendations ? (<p style={styles.loading}>Loading recommendations...</p>) : (
                    recommendations.length === 0 ? (<p style={styles.noItems}>No new recommendations right now. Check back later!</p>) : (
                        <ul style={styles.list}>
                            {recommendations.map(rec => (
                                <li key={rec.user_id} style={styles.listItem}>
                                    <div style={styles.userInfo}>
                                        {renderAvatar(rec, 40, onlineFriendIds.has(rec.user_id))}
                                        <div style={styles.userDetails}>
                                            <Link to={`/profile/${rec.username}`} style={styles.profileLink}>{rec.username}</Link>
                                            <span style={styles.fullName}>({rec.first_name} {rec.last_name})</span>
                                        </div>
                                    </div>
                                    <div style={styles.actions}>
                                        <button
                                            onClick={() => handleSendFriendRequest(rec.user_id, rec.username)}
                                            style={{ ...styles.button, ...styles.addFriendButton }}
                                        >
                                            Add Friend
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )
                )}
            </div>

            <div style={styles.section}>
                <h3 style={styles.heading}>Your Friends ({friends.length}) {loadingOnlineStatus && <span style={styles.loading}> (checking online status...)</span>}</h3>
                {loadingFriends ? (<p style={styles.loading}>Loading friends...</p>) : (
                    friends.length === 0 ? (<p style={styles.noItems}>You have no friends yet. Find users via Search!</p>) : (
                        <>
                            {onlineFriends.length > 0 && <h4 style={styles.listHeader}>Online ({onlineFriends.length})</h4>}
                            <ul style={{...styles.list, marginBottom: onlineFriends.length > 0 && offlineFriends.length > 0 ? '20px' : '0'}}>
                                {onlineFriends.map(friend => (
                                    <li key={friend.user_id} style={styles.listItem}>
                                        <div style={styles.userInfo}>
                                            {renderAvatar(friend, 40, true)}
                                            <div style={styles.userDetails}>
                                                <Link to={`/profile/${friend.username}`} style={styles.profileLink}>{friend.username}</Link>
                                                <span style={styles.fullName}>({friend.first_name} {friend.last_name})</span>
                                            </div>
                                        </div>
                                        <div style={styles.actions}>
                                            <button onClick={() => triggerUnfriendModal(friend.user_id, friend.username)} style={{ ...styles.button, ...styles.unfriendButton }}>Unfriend</button>
                                        </div>
                                    </li>
                                ))}
                            </ul>

                             {offlineFriends.length > 0 && <h4 style={styles.listHeader}>Offline ({offlineFriends.length})</h4>}
                            <ul style={styles.list}>
                                {offlineFriends.map(friend => (
                                    <li key={friend.user_id} style={styles.listItem}>
                                        <div style={styles.userInfo}>
                                            {renderAvatar(friend, 40, false)} 
                                            <div style={styles.userDetails}>
                                                <Link to={`/profile/${friend.username}`} style={styles.profileLink}>{friend.username}</Link>
                                                <span style={styles.fullName}>({friend.first_name} {friend.last_name})</span>
                                            </div>
                                        </div>
                                        <div style={styles.actions}>
                                            <button onClick={() => triggerUnfriendModal(friend.user_id, friend.username)} style={{ ...styles.button, ...styles.unfriendButton }}>Unfriend</button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )
                )}
            </div>
        </div>
    );
}
export default FriendsPage;