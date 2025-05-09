import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ImageUploader from './ImageUploader';
import { useGlobalToasts } from '../contexts/ToastContext';
import ActorLinkModal from './ActorLinkModal';
import HashtagInterestsModal from './HashtagInterestsModal';
import PostCard from './PostCard';

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
                        style={{
                            padding: '9px 18px', borderRadius: '7px', border: '1px solid #ced4da',
                            backgroundColor: '#f8f9fa', color: '#343a40', cursor: 'pointer',
                            fontSize: '0.9em', fontWeight: '500', transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e9ecef'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: '9px 18px', borderRadius: '7px', border: 'none',
                            backgroundColor: '#dc3545', color: 'white', cursor: 'pointer',
                            fontSize: '0.9em', fontWeight: '500', transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#c82333'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#dc3545'}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

const MutualArrowsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
        <path d="M20.5 10.5711L17.5 8V10H6.5V8L3.5 10.5711L6.5 13.1421V11.1421H17.5V13.1421L20.5 10.5711Z" />
    </svg>
);
const UserPlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line>
    </svg>
);
const UserCheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline>
    </svg>
);
const UserXIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="18" y1="8" x2="23" y2="13"></line><line x1="23" y1="8" x2="18" y2="13"></line>
    </svg>
);
const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
);
const LinkIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
    </svg>
);
const FilmIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '10px' }}>
        <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
    </svg>
);


const formatFriendshipDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const dateDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowDayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffTime = nowDayStart.getTime() - dateDayStart.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks === 1) return 'Last Week';
    if (diffWeeks <= 4) return `${diffWeeks} weeks ago`;
    const diffMonths = Math.floor(diffDays / 30.4375);
    if (diffMonths === 1) return 'Last month';
    if (diffMonths < 12) return `${diffMonths} months ago`;
    const diffYears = Math.floor(diffDays / 365.25);
    if (diffYears === 1) return 'Last year';
    return `${diffYears} years ago`;
};

function ProfilePage({ user, onProfileUpdate }) {
    const { addToast: globalAddToast } = useGlobalToasts();

    const { id: routeId } = useParams();
    const navigate = useNavigate();
    const [profileData, setProfileData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [friendshipStatus, setFriendshipStatus] = useState(null);
    const [isFriendshipLoading, setIsFriendshipLoading] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmModalContent, setConfirmModalContent] = useState({ title: '', message: '', onConfirm: () => { } });
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [profileImageError, setProfileImageError] = useState(false);
    const [actorInfo, setActorInfo] = useState({});
    const [showActorLinkModal, setShowActorLinkModal] = useState(false); 
    const [userPosts, setUserPosts] = useState([]);
    const [areUserPostsLoading, setAreUserPostsLoading] = useState(false);
    const [userInterests, setUserInterests] = useState([]);
    const [areInterestsLoading, setAreInterestsLoading] = useState(false);
    const [showInterestsModal, setShowInterestsModal] = useState(false);
    const [bookmarkedPosts, setBookmarkedPosts] = useState([]);
    const [areBookmarkedPostsLoading, setAreBookmarkedPostsLoading] = useState(false);
    const [loggedInUserBookmarkedIds, setLoggedInUserBookmarkedIds] = useState(new Set());


    const addToast = useCallback((message, type = 'info', duration = 3500) => {
        globalAddToast({ content: message, type, duration });
    }, [globalAddToast]);

    const isOwnProfile = !routeId || (user && profileData && user.userId === profileData.userId);

    const fetchUserInterests = useCallback(async () => {
        if (!user || !isOwnProfile) return; 
        setAreInterestsLoading(true);
        try {
            const response = await axios.get('/api/users/interests');
            setUserInterests(response.data);
        } catch (err) {
            console.error('Error fetching user interests:', err);
            addToast(err.response?.data?.error || 'Failed to load interests.', 'error');
            setUserInterests([]);
        } finally {
            setAreInterestsLoading(false);
        }
    }, [user, isOwnProfile, addToast]);

    const fetchUserPosts = useCallback(async (profileIdentifier) => {
        if (!profileIdentifier) return;
        setAreUserPostsLoading(true);
        try {
            const response = await axios.get(`/api/users/profile/${profileIdentifier}/posts`);
            setUserPosts(response.data);
        } catch (err) {
            console.error('Error fetching user posts:', err);
            addToast(err.response?.data?.error || 'Failed to load user posts.', 'error');
            setUserPosts([]); 
        } finally {
            setAreUserPostsLoading(false);
        }
    }, [addToast]);

    const fetchBookmarkedPosts = useCallback(async (profileUsername) => {
        if (!profileUsername) return;
        setAreBookmarkedPostsLoading(true);
        try {
            const response = await axios.get(`/api/bookmarks/user/${profileUsername}`);
            setBookmarkedPosts(response.data.bookmarkedPosts || []);
        } catch (err) {
            console.error('Error fetching bookmarked posts:', err);
            addToast(err.response?.data?.error || 'Failed to load bookmarked posts.', 'error');
            setBookmarkedPosts([]);
        } finally {
            setAreBookmarkedPostsLoading(false);
        }
    }, [addToast]);

    const fetchLoggedInUserBookmarkedIds = useCallback(async () => {
        if (!user) return;
        try {
            const response = await axios.get('/api/bookmarks/ids');
            setLoggedInUserBookmarkedIds(new Set(response.data.bookmarkedPostIds || []));
        } catch (err) {
            console.error("Error fetching logged-in user's bookmarked post IDs:", err);
            setLoggedInUserBookmarkedIds(new Set());
        }
    }, [user]);

    const fetchProfile = useCallback(async () => {
        setIsLoading(true);
        setError('');
        setFriendshipStatus(null);
        setProfileImageError(false);
        try {
            const profileIdentifier = routeId || (user ? user.username : null);
            if (!profileIdentifier) {
                setError("User not logged in and no profile ID specified.");
                setProfileData(null);
                setIsLoading(false);
                return;
            }
            const response = await axios.get(`/api/users/profile/${profileIdentifier}`);
            const newProfileData = response.data;
            setProfileData(newProfileData);

            if (newProfileData) {
                fetchUserPosts(profileIdentifier);
            }
            if (newProfileData && newProfileData.username) {
                fetchBookmarkedPosts(newProfileData.username);
            }

            if (newProfileData.candidateActorIds || newProfileData.linkedActorId) {
                let nconsts = [];
                if (newProfileData.candidateActorIds) {
                    nconsts = newProfileData.candidateActorIds.split(',');
                }
                if (newProfileData.linkedActorId) {
                    let lid = newProfileData.linkedActorId;
                    lid = lid.replace('.jpg', '');
                    lid = lid.split("-")[0];
                    nconsts.push(lid);
                }
                nconsts = [...new Set(nconsts)].filter(nconst => nconst !== null && nconst !== '');
                
                if (nconsts.length > 0) {
                    const actorsResponse = await axios.post(`/api/images/get-actor-info`, { nconsts });
                    console.log(actorsResponse.data);
                    let actorsInfoAsDict = {};
                    actorsResponse.data.forEach(actor => {
                        actorsInfoAsDict[actor.nconst] = actor;
                    });
                    setActorInfo(actorsInfoAsDict);
                } else {
                    setActorInfo({});
                }
            } else {
                setActorInfo({});
            }

        } catch (err) {
            console.error('Error fetching profile:', err);
            const errorMessage = err.response?.data?.error || 'Failed to load profile.';
            setError(errorMessage);
            addToast(`Profile Load Error: ${errorMessage}`, 'error');
            setProfileData(null);
        } finally {
            setIsLoading(false);
        }
    }, [routeId, user, addToast, fetchUserPosts, fetchBookmarkedPosts]);


    useEffect(() => {
        fetchProfile();
        if (isOwnProfile) {
            fetchUserInterests();
        }
        fetchLoggedInUserBookmarkedIds();
    }, [fetchProfile, isOwnProfile, fetchUserInterests, fetchLoggedInUserBookmarkedIds]); 

    useEffect(() => {
        if (user && profileData && !isOwnProfile) {
            const fetchFriendshipStatus = async () => {
                setIsFriendshipLoading(true);
                try {
                    const response = await axios.get(`/api/friendships/status/${profileData.userId}`);
                    setFriendshipStatus(response.data.friendship);
                } catch (err) {
                    console.error('Error fetching friendship status:', err);
                    addToast('Could not load friendship status.', 'error');
                    setFriendshipStatus(null);
                } finally {
                    setIsFriendshipLoading(false);
                }
            };
            fetchFriendshipStatus();
        } else if (isOwnProfile) {
            setFriendshipStatus(null);
        }
    }, [user, profileData, isOwnProfile, addToast]);

    useEffect(() => {
        if (user && isOwnProfile && profileData && user.email && profileData.email !== user.email) {
            setProfileData(prevData => ({
                ...prevData,
                email: user.email
            }));
        }
    }, [user, isOwnProfile, profileData]);

    const handleSendFriendRequest = async () => {
        if (!profileData) return;
        setIsFriendshipLoading(true);
        try {
            const response = await axios.post('/api/friendships/request', { recipientId: profileData.userId });
            setFriendshipStatus(response.data.friendship);
            addToast('Friend request sent!', 'success');
        } catch (err) {
            addToast(err.response?.data?.error || 'Failed to send friend request.', 'error');
            if (err.response?.data?.friendship) {
                setFriendshipStatus(err.response.data.friendship);
            }
        } finally {
            setIsFriendshipLoading(false);
        }
    };

    const handleCancelRequest = async () => {
        if (!friendshipStatus || !friendshipStatus.friendship_id) return;
        setIsFriendshipLoading(true);
        try {
            await axios.post('/api/friendships/reject', { friendshipId: friendshipStatus.friendship_id });
            setFriendshipStatus(null);
            addToast('Friend request cancelled.', 'info');
        } catch (err) {
            addToast(err.response?.data?.error || 'Failed to cancel request.', 'error');
        } finally {
            setIsFriendshipLoading(false);
        }
    };

    const handleAcceptRequest = async () => {
        if (!friendshipStatus || !friendshipStatus.friendship_id) return;
        setIsFriendshipLoading(true);
        try {
            const response = await axios.post('/api/friendships/accept', { friendshipId: friendshipStatus.friendship_id });
            setFriendshipStatus(response.data.friendship);
            addToast('Friend request accepted!', 'success');
        } catch (err) {
            addToast(err.response?.data?.error || 'Failed to accept request.', 'error');
        } finally {
            setIsFriendshipLoading(false);
        }
    };

    const handleRejectRequest = async () => {
        if (!friendshipStatus || !friendshipStatus.friendship_id) return;
        setIsFriendshipLoading(true);
        try {
            await axios.post('/api/friendships/reject', { friendshipId: friendshipStatus.friendship_id });
            setFriendshipStatus(null);
            addToast('Friend request rejected.', 'info');
        } catch (err) {
            addToast(err.response?.data?.error || 'Failed to reject request.', 'error');
        } finally {
            setIsFriendshipLoading(false);
        }
    };

    const handleUnfriend = async () => {
        if (!profileData || !friendshipStatus || friendshipStatus.status !== 'accepted') return;

        setConfirmModalContent({
            title: 'Confirm Unfriend',
            message: <p>Are you sure you want to unfriend <strong>{profileData.username}</strong>?</p>,
            onConfirm: async () => {
                setShowConfirmModal(false);
                setIsFriendshipLoading(true);
                try {
                    await axios.delete(`/api/friendships/${profileData.userId}`);
                    setFriendshipStatus(null);
                    addToast(`You are no longer friends with ${profileData.username}.`, 'info');
                } catch (err) {
                    addToast(err.response?.data?.error || 'Failed to unfriend.', 'error');
                } finally {
                    setIsFriendshipLoading(false);
                }
            }
        });
        setShowConfirmModal(true);
    };

    const openActorLinkModal = () => setShowActorLinkModal(true);
    const closeActorLinkModal = () => setShowActorLinkModal(false);

    const handleLinkActorIdentity = async (actorIdToLink, actorName) => {
        if (!actorIdToLink) {
            addToast('No actor selected to link.', 'error');
            return;
        }
        try {
            await axios.post('/api/images/link-actor', { selectedActorId: actorIdToLink, selectedActorName: actorName  });
            addToast(`Successfully linked to ${actorName || 'actor'}!`, 'success');
            if (onProfileUpdate) {
                await onProfileUpdate();
            }
            closeActorLinkModal();
        } catch (err) {
            addToast(err.response?.data?.error || `Failed to link to ${actorName || 'actor'}.`, 'error');
        }
    };

    const handleUnlinkActorIdentity = async () => {
        try {
            await axios.post('/api/images/unlink-actor');
            addToast('Actor identity unlinked successfully.', 'success');
            if (onProfileUpdate) {
                await onProfileUpdate();
            }
            closeActorLinkModal();
        } catch (err) {
            addToast(err.response?.data?.error || 'Failed to unlink actor identity.', 'error');
        }
    };

    const handleSaveInterests = async (selectedHashtagTexts) => {
        if (!user) return;
        try {
            await axios.put('/api/users/interests', { hashtagTexts: selectedHashtagTexts });
            addToast('Interests updated successfully!', 'success');
            fetchUserInterests(); 
            setShowInterestsModal(false);
        } catch (err) {
            console.error('Error updating interests:', err);
            addToast(err.response?.data?.error || 'Failed to update interests.', 'error');
        }
    };

    const profilePicStyle = { width: '150px', height: '150px', borderRadius: '50%', border: '3px solid #efefef', objectFit: 'cover', backgroundColor: '#e0e0e0', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' };
    const renderProfilePic = (targetUser) => {
         const errorTextStyle = { ...profilePicStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: '1em', color: '#777', padding: '10px', lineHeight: '1.4em', fontWeight: '500', backgroundColor: '#e9ecef' };
         if (profileImageError) { return isOwnProfile ? <div style={errorTextStyle}>Invalid Picture,<br />Upload a New One</div> : <div style={errorTextStyle}>No Picture Found</div>; }
        
         const photoUrlToDisplay = targetUser?.profilePhotoUrl;

         if (photoUrlToDisplay) { return <img style={profilePicStyle} src={photoUrlToDisplay} alt={`${targetUser.username}'s profile`} onError={() => { console.warn(`Image failed to load: ${photoUrlToDisplay}`); setProfileImageError(true); }}/>; }
         else if (targetUser) { const initial = targetUser.username ? targetUser.username.charAt(0).toUpperCase() : '?'; return <div style={{ ...profilePicStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4.5em', color: '#bdbdbd', fontWeight: 'bold' }}>{initial}</div>; }
         return <div style={{ ...profilePicStyle, backgroundColor: '#f0f0f0' }}></div>;
    };
    const buttonStyle = { padding: '10px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.95em', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.2s ease, box-shadow 0.2s ease', minWidth: '150px', margin: '5px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' };
    const primaryButtonStyle = { ...buttonStyle, backgroundColor: '#007bff', color: 'white' };
    const secondaryButtonStyle = { ...buttonStyle, backgroundColor: '#6c757d', color: 'white' };
    const dangerButtonStyle = { ...buttonStyle, backgroundColor: '#dc3545', color: 'white' };
    const successButtonStyle = { ...buttonStyle, backgroundColor: '#28a745', color: 'white' };
    // const infoButtonStyle = { ...buttonStyle, backgroundColor: '#17a2b8', color: 'white' };

    if (isLoading && !profileData) { return <div style={{ padding: '40px', textAlign: 'center', fontSize: '1.2em', color: '#555' }}>Loading profile...</div>; }
    if (error && !profileData) { return (<div style={{ padding: '40px', textAlign: 'center', color: 'red' }}><h2>Error</h2><p>{error}</p>{error === 'Profile not found.' && ( <p>Return to <Link to="/" style={{color: '#007bff'}}>Homepage</Link>.</p> )}</div>); }
    if (!profileData && !isLoading) { return <div style={{ padding: '40px', textAlign: 'center' }}>Profile could not be loaded. Please try again later.</div>; }

    const displayUser = profileData;
    let friendshipContent = null;
    if (user && !isOwnProfile && displayUser) {
        if (isFriendshipLoading) { friendshipContent = <p style={{ color: '#555', fontStyle: 'italic' }}>Loading friendship status...</p>; }
        else if (friendshipStatus) {
            if (friendshipStatus.status === 'accepted') { friendshipContent = (<div><p style={{ display: 'flex', alignItems: 'center', fontSize: '1.1em', fontWeight: '500', color: '#28a745', justifyContent: 'center' }}><MutualArrowsIcon /> Friends</p><p style={{ fontSize: '0.9em', color: '#777', marginTop: '-10px', marginBottom: '15px', display: 'flex', justifyContent: 'center' }}>Since {formatFriendshipDate(friendshipStatus.created_at)}</p><button onClick={handleUnfriend} style={dangerButtonStyle} title="Unfriend this user"><UserXIcon /> Unfriend</button></div>); }
            else if (friendshipStatus.status === 'pending') {
                if (friendshipStatus.action_user_id === user.userId) { friendshipContent = (<div><p style={{ color: '#ffc107', fontWeight: '500' }}>Friend Request Pending</p><button onClick={handleCancelRequest} style={secondaryButtonStyle}>Cancel Request</button></div>); }
                else { friendshipContent = (<div><p style={{ color: '#17a2b8', fontWeight: '500' }}>{displayUser.username} sent you a friend request!</p><p style={{ fontSize: '0.9em', color: '#777', marginTop: '-10px', marginBottom: '15px', display: 'flex', justifyContent: 'center' }}>Sent {formatFriendshipDate(friendshipStatus.created_at)}</p><button onClick={handleAcceptRequest} style={successButtonStyle}><UserCheckIcon /> Accept</button><button onClick={handleRejectRequest} style={{...dangerButtonStyle, marginLeft: '10px'}}>Reject</button></div>); }
            }
        } else { friendshipContent = (<div><p style={{ color: '#6c757d' }}>You are not friends with {displayUser.username}.</p><button onClick={handleSendFriendRequest} style={primaryButtonStyle}><UserPlusIcon /> Send Friend Request</button></div>); }
    }
    let chatSection = null;
    if (user && !isOwnProfile && displayUser) {
        if (friendshipStatus && friendshipStatus.status === 'accepted') { chatSection = (<button onClick={() => navigate('/chat')} style={{ ...primaryButtonStyle, backgroundColor: '#5a4fcf', marginTop: '10px' }} title={`Chat with ${displayUser.username}`}>Chat with {displayUser.username}</button>); }
        else { chatSection = (<p style={{ marginTop: '20px', color: '#777', fontSize: '0.95em', backgroundColor: '#dfdedb', padding: '10px', borderRadius: '6px', border: '1px solid #e9ecef' }}>You need to be friends with {displayUser.username} to chat with them.</p>); }
    }

    const linkedActorNconst = displayUser.linkedActorId ? displayUser.linkedActorId.split("-")[0].replace('.jpg','') : null;
    const linkedActorDetails = linkedActorNconst && actorInfo[linkedActorNconst] ? actorInfo[linkedActorNconst] : null;

    const candidateActorsForModal = displayUser.candidateActorIds
        ? displayUser.candidateActorIds.split(',')
            .map(nconst => actorInfo[nconst.replace('.jpg','').split("-")[0]])
            .filter(Boolean)
        : [];

    return (
        <div style={{ padding: '20px 30px', maxWidth: '750px', margin: '30px auto', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 8px 25px rgba(0,0,0,0.1)' }}>
            <ConfirmationModal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                onConfirm={confirmModalContent.onConfirm}
                title={confirmModalContent.title}
            >
                {confirmModalContent.message}
            </ConfirmationModal>

            {user && <UserSettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                user={user}
                addToast={addToast}
                onProfileUpdate={onProfileUpdate}
            />}

            {isOwnProfile && showActorLinkModal && displayUser && (
                <ActorLinkModal
                    isOpen={showActorLinkModal}
                    onClose={closeActorLinkModal}
                    candidateActors={candidateActorsForModal}
                    linkedActorId={displayUser.linkedActorId}
                    linkedActorDetails={linkedActorDetails}
                    actorInfo={actorInfo}
                    onLinkActor={handleLinkActorIdentity}
                    onUnlinkActor={handleUnlinkActorIdentity}
                    addToast={addToast}
                />
            )}

            {isOwnProfile && (
                <HashtagInterestsModal 
                    isOpen={showInterestsModal}
                    onClose={() => setShowInterestsModal(false)}
                    currentInterests={userInterests} 
                    onSave={handleSaveInterests}
                    addToast={addToast}
                />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '30px', flexGrow: 1 }}>
                    <div style={{ flexShrink: 0 }}>
                        {renderProfilePic(displayUser)}
                    </div>
                    <div style={{ flexGrow: 1 }}>
                        <h2 style={{ marginTop: '5px', marginBottom: '10px', fontSize: '2.2em', color: '#333', fontWeight: 600 }}>{displayUser.username}</h2>
                        <p style={{ margin: '4px 0', fontSize: '1.1em', color: '#555' }}><strong>{displayUser.firstName} {displayUser.lastName}</strong></p>
                        <p style={{ margin: '4px 0', color: '#666' }}><strong>Email:</strong> {displayUser.email}</p>
                        <p style={{ margin: '4px 0', color: '#666' }}><strong>Affiliation:</strong> {displayUser.affiliation || 'N/A'}</p>
                        <p style={{ margin: '4px 0', color: '#666', marginBottom: '15px' }}><strong>Birthday:</strong> {displayUser.birthday ? new Date(displayUser.birthday).toLocaleDateString() : 'N/A'}</p>

                        {isOwnProfile && (
                            <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                <h4 style={{ marginTop: 0, marginBottom: '12px', fontSize: '1.05em', color: '#333', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                                    <LinkIcon /> <span style={{marginLeft: '8px'}}>Actor Identity Link</span>
                                </h4>
                                {displayUser.linkedActorId && linkedActorDetails ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#e9f5ff', borderRadius: '6px', border: '1px solid #bee5eb'}}>
                                            <img 
                                                src={linkedActorDetails.profilePhotoUrl + ".jpg"} 
                                                alt={linkedActorDetails.name} 
                                                style={{ width: '50px', height: '50px', borderRadius: '50%', marginRight: '15px', objectFit: 'cover' }}
                                            />
                                            <div style={{flexGrow: 1}}>
                                                <p style={{ margin: 0, fontSize: '1em', fontWeight: 'bold', color: '#004085' }}>
                                                    {linkedActorDetails.name}
                                                </p>
                                                <p style={{ margin: '2px 0 0 0', fontSize: '0.85em', color: '#004085' }}>
                                                    Currently linked to this actor.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={openActorLinkModal}
                                            style={{
                                                padding: '8px 12px', fontSize: '0.85em', color: '#fff',
                                                backgroundColor: '#007bff', border: 'none', borderRadius: '6px',
                                                cursor: 'pointer', transition: 'background-color 0.2s ease',
                                                alignSelf: 'flex-start'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#0056b3'}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#007bff'}
                                        >
                                            Manage Link
                                        </button>
                                    </div>
                                ) : !displayUser.linkedActorId && displayUser.candidateActorIds && candidateActorsForModal.length > 0 ? (
                                    <div style={{ textAlign: 'center' }}>
                                        <p style={{ margin: '0 0 12px 0', fontSize: '0.95em', color: '#666' }}>
                                            You have potential actor matches. Link your profile to an actor.
                                        </p>
                                        <button
                                            onClick={openActorLinkModal}
                                            style={{
                                                padding: '9px 18px', fontSize: '0.9em', color: '#fff',
                                                backgroundColor: '#28a745', border: 'none', borderRadius: '6px',
                                                cursor: 'pointer', transition: 'background-color 0.2s ease',
                                                display: 'inline-flex', alignItems: 'center', gap: '8px'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#218838'}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#28a745'}
                                        >
                                            <LinkIcon /> Link to Actor
                                        </button>
                                    </div>
                                ) : (
                                     <p style={{ margin: '0 0 12px 0', fontSize: '0.95em', color: '#666' }}>
                                        No actor linked. Upload a new profile picture to find potential actor matches and link your profile.
                                    </p>
                                )}
                            </div>
                        )}
                        {!isOwnProfile && displayUser.linkedActorId && linkedActorDetails && (
                            <div style={{ marginTop: '15px', padding: '12px 15px', backgroundColor: '#e9f5ff', borderRadius: '8px', border: '1px solid #bee5eb', display: 'flex', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                <img 
                                    src={linkedActorDetails.profilePhotoUrl + ".jpg"} 
                                    alt={linkedActorDetails.name} 
                                    style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '12px', objectFit: 'cover', border: '2px solid #fff' }}
                                />
                                <div style={{flexGrow: 1}}>
                                    <p style={{ margin: 0, fontSize: '0.95em', color: '#004085' }}>
                                        <strong style={{fontWeight: 600}}>Actor Linked:</strong> {linkedActorDetails.name}
                                    </p>
                                </div>
                                <FilmIcon />
                            </div>
                        )}

                    </div>
                </div>
                {isOwnProfile && user && (
                    <button onClick={() => setShowSettingsModal(true)} title="Account Settings" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', color: '#555', marginLeft: '10px', alignSelf: 'flex-start' }} onMouseEnter={e => e.currentTarget.style.color = '#000'} onMouseLeave={e => e.currentTarget.style.color = '#555'} >
                        <SettingsIcon />
                    </button>
                )}
            </div>

            {isOwnProfile && profileData && (
                <div style={{ marginTop: '20px', paddingBottom: '20px', borderTop: '1px solid #e9ecef', borderBottom: '1px solid #e9ecef' }}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', paddingTop: '20px'}}>
                        <h3 style={{ fontSize: '1.3em', color: '#333', margin: 0 }}>Your Hashtag Interests</h3>
                        <button 
                            onClick={() => setShowInterestsModal(true)}
                            style={{
                                padding: '8px 12px', fontSize: '0.9em', color: '#fff',
                                backgroundColor: '#007bff', border: 'none', borderRadius: '6px',
                                cursor: 'pointer', transition: 'background-color 0.2s ease',
                                alignSelf: 'flex-start'
                            }}
                        >
                            Manage Interests
                        </button>
                    </div>
                    {areInterestsLoading && <p>Loading interests...</p>}
                    {!areInterestsLoading && userInterests.length === 0 && (
                        <p style={{color: '#777', fontStyle: 'italic'}}>You haven't selected any interests yet.</p>
                    )}
                    {!areInterestsLoading && userInterests.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {userInterests.map(interest => (
                                <span key={interest.hashtag_id} style={{
                                    backgroundColor: '#007bff', 
                                    color: 'white', 
                                    padding: '5px 10px', 
                                    borderRadius: '15px', 
                                    fontSize: '0.9em'
                                }}>
                                    {interest.tag_text}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {isOwnProfile && (
                <div style={{ borderTop: '1px solid #e9ecef', paddingTop: '25px' }}>
                    <ImageUploader onProfileUpdate={onProfileUpdate} addToast={addToast} />
                </div>
            )}

            {!isOwnProfile && user && displayUser && (
                <div style={{ marginTop: '25px', borderTop: '1px solid #e9ecef', paddingTop: '25px', paddingBottom: '10px' }}>
                    <h3 style={{ marginBottom: '15px', fontSize: '1.4em', color: '#444' }}>Friendship with {displayUser.username}</h3>
                    <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #e9ecef', boxShadow: '0 4px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        {friendshipContent}
                        {chatSection}
                    </div>
                </div>
            )}
            {error && profileData && <p style={{ color: 'orange', textAlign: 'center', marginTop: '15px', fontSize: '0.9em' }}>{error}</p>}

            {profileData && (
                <div style={{ marginTop: '30px', borderTop: '1px solid #e9ecef', paddingTop: '20px' }}>
                    <h3 style={{ marginBottom: '20px', fontSize: '1.5em', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>
                        Posts by {profileData.username}
                    </h3>
                    {areUserPostsLoading && <p style={{textAlign: 'center', color: '#555'}}>Loading posts...</p>}
                    {!areUserPostsLoading && userPosts.length === 0 && (
                        <p style={{textAlign: 'center', color: '#777', fontStyle: 'italic'}}>This user hasn't made any posts yet.</p>
                    )}
                    {!areUserPostsLoading && userPosts.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {userPosts.map(post => (
                                    <PostCard 
                                        key={`user-post-${post.post_id}`}
                                        post={{ ...post, author: profileData }} 
                                        user={user} 
                                        isBookmarked={loggedInUserBookmarkedIds.has(post.post_id)}
                                        onToggleBookmark={fetchLoggedInUserBookmarkedIds}
                                    />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {profileData && (
                <div style={{ marginTop: '30px', borderTop: '1px solid #e9ecef', paddingTop: '20px' }}>
                    <h3 style={{ marginBottom: '20px', fontSize: '1.5em', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>
                        Bookmarked Posts by {profileData.username}
                    </h3>
                    {areBookmarkedPostsLoading && <p style={{textAlign: 'center', color: '#555'}}>Loading bookmarked posts...</p>}
                    {!areBookmarkedPostsLoading && bookmarkedPosts.length === 0 && (
                        <p style={{textAlign: 'center', color: '#777', fontStyle: 'italic'}}>
                            {isOwnProfile ? "You haven't bookmarked any posts yet." : `${profileData.username} hasn't bookmarked any posts yet.`}
                        </p>
                    )}
                    {!areBookmarkedPostsLoading && bookmarkedPosts.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {bookmarkedPosts.map(post => (
                                <PostCard 
                                    key={`bookmark-post-${post.post_id}`} 
                                    post={post} 
                                    user={user} 
                                    isBookmarked={loggedInUserBookmarkedIds.has(post.post_id)}
                                    onToggleBookmark={fetchLoggedInUserBookmarkedIds}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


const UserSettingsModal = ({ isOpen, onClose, user, addToast, onProfileUpdate }) => {
    const [newEmail, setNewEmail] = useState(user?.email || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setNewEmail(user?.email || '');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
            setEmailError('');
            setPasswordError('');
        }
    }, [isOpen, user]);

    if (!isOpen) return null;

    const handleEmailChange = async (e) => {
        e.preventDefault();
        setEmailError('');
        if (!newEmail || !/\S+@\S+\.\S+/.test(newEmail)) { setEmailError('Please enter a valid email address.'); return; }
        if (newEmail === user.email) { setEmailError('This is already your current email address.'); return; }

        setIsUpdatingEmail(true);
        try {
            await axios.put('/api/users/settings/email', { newEmail });
            addToast('Email updated successfully!', 'success');
            if (onProfileUpdate) { 
                await onProfileUpdate({ ...user, email: newEmail });
            }
            onClose();
        } catch (err) {
            const errorMsg = err.response?.data?.error || 'Failed to update email.';
            setEmailError(errorMsg);
            addToast(errorMsg, 'error');
        } finally {
            setIsUpdatingEmail(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPasswordError('');
        if (!currentPassword || !newPassword || !confirmNewPassword) { setPasswordError('All password fields are required.'); return; }
        if (newPassword.length < 8) { setPasswordError('New password must be at least 8 characters long.'); return; }
        if (newPassword !== confirmNewPassword) { setPasswordError('New passwords do not match.'); return; }

        setIsUpdatingPassword(true);
        try {
            await axios.put('/api/users/settings/password', { currentPassword, newPassword });
            addToast('Password updated successfully!', 'success');
            setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
            onClose();
        } catch (err) {
            const errorMsg = err.response?.data?.error || 'Failed to update password.';
            setPasswordError(errorMsg);
            addToast(errorMsg, 'error');
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const modalStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' };
    const contentStyle = { backgroundColor: '#ffffff', padding: '30px 35px', borderRadius: '12px', boxShadow: '0 8px 25px rgba(0,0,0,0.25)', width: 'auto', maxWidth: '480px', textAlign: 'left' };
    const inputStyle = { width: '100%', padding: '10px', margin: '8px 0 16px', borderRadius: '6px', border: '1px solid #ced4da', boxSizing: 'border-box', fontSize: '1em' };
    const buttonStyle = { padding: '10px 20px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontWeight: '500', fontSize: '0.95em', transition: 'background-color 0.2s' };
    const errorTextStyle = { color: '#dc3545', fontSize: '0.85em', marginTop: '-10px', marginBottom: '10px' };

    return (
        <div style={modalStyle}>
            <div style={contentStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ marginTop: 0, marginBottom: 0, fontSize: '1.6em', color: '#333', fontWeight: 600 }}>Account Settings</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.8em', cursor: 'pointer', color: '#888', padding: '0 5px' }}>×</button>
                </div>
                <form onSubmit={handleEmailChange} style={{ marginBottom: '30px', borderBottom: '1px solid #e9ecef', paddingBottom: '25px' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '1.2em', color: '#555', fontWeight: 500 }}>Change Email</h3>
                    <label htmlFor="newEmailUserSettings" style={{ fontWeight: '500', fontSize: '0.9em', color: '#495057' }}>New Email Address</label>
                    <input type="email" id="newEmailUserSettings" style={inputStyle} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} disabled={isUpdatingEmail} required />
                    {emailError && <p style={errorTextStyle}>{emailError}</p>}
                    <button type="submit" disabled={isUpdatingEmail} style={{ ...buttonStyle, backgroundColor: '#007bff', color: 'white' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#0069d9'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#007bff'}>{isUpdatingEmail ? 'Updating...' : 'Update Email'}</button>
                </form>
                <form onSubmit={handlePasswordChange}>
                     <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '1.2em', color: '#555', fontWeight: 500 }}>Change Password</h3>
                    <label htmlFor="currentPasswordUserSettings" style={{ fontWeight: '500', fontSize: '0.9em', color: '#495057' }}>Current Password</label> <input type="password" id="currentPasswordUserSettings" style={inputStyle} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={isUpdatingPassword} required />
                    <label htmlFor="newPasswordUserSettings" style={{ fontWeight: '500', fontSize: '0.9em', color: '#495057' }}>New Password</label> <input type="password" id="newPasswordUserSettings" style={inputStyle} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isUpdatingPassword} required />
                    <label htmlFor="confirmNewPasswordUserSettings" style={{ fontWeight: '500', fontSize: '0.9em', color: '#495057' }}>Confirm New Password</label> <input type="password" id="confirmNewPasswordUserSettings" style={inputStyle} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} disabled={isUpdatingPassword} required />
                    {passwordError && <p style={errorTextStyle}>{passwordError}</p>}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                         <button type="submit" disabled={isUpdatingPassword} style={{ ...buttonStyle, backgroundColor: '#28a745', color: 'white' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#218838'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#28a745'}>{isUpdatingPassword ? 'Updating...' : 'Update Password'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfilePage;