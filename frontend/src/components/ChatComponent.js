import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import io from "socket.io-client";
import { useGlobalToasts } from '../contexts/ToastContext';

const SendIcon = ({ active }) => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
            fill: active ? "#fff" : "#fff", 
            transition: "transform 0.1s ease-out",
        }}
    >
        <path d="M12 2L22 12L12 22L10.59 20.59L18.17 13H2V11H18.17L10.59 3.41L12 2Z" />
    </svg>
);

const CheckmarkIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: '#007bff' }}>
        <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, children }) => {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}>
            <div style={{
                backgroundColor: '#fff',
                padding: '25px',
                borderRadius: '8px',
                boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
                width: 'auto',
                maxWidth: '400px',
                textAlign: 'center',
            }}>
                <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '1.2em', color: '#333' }}>{title}</h3>
                <div style={{ marginBottom: '25px', fontSize: '0.95em', color: '#555' }}>
                    {children}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 15px',
                            borderRadius: '5px',
                            border: '1px solid #ccc',
                            backgroundColor: '#f0f0f0',
                            color: '#333',
                            cursor: 'pointer',
                            fontSize: '0.9em',
                            fontWeight: '500',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: '8px 15px',
                            borderRadius: '5px',
                            border: 'none',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.9em',
                            fontWeight: '500',
                        }}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};
const InviteToChatModal = ({ isOpen, onClose, onConfirm, title, children, friends, currentChatMembers, onToggleFriend, selectedFriends, userMap, renderAvatar }) => {
    if (!isOpen) return null;

    const availableFriends = friends.filter(f => !currentChatMembers.includes(f.user_id));

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 2001,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}>
            <div style={{
                backgroundColor: '#fff', padding: '25px', borderRadius: '8px',
                boxShadow: '0 5px 15px rgba(0,0,0,0.3)', width: 'auto', maxWidth: '450px',
                textAlign: 'left',
            }}>
                <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '1.2em', color: '#333', textAlign: 'center' }}>{title}</h3>
                <div style={{ marginBottom: '20px', fontSize: '0.95em', color: '#555', maxHeight: '300px', overflowY: 'auto' }}>
                    {children}
                    {availableFriends.length === 0 && <p style={{ textAlign: 'center', color: '#777' }}>No other friends to invite to this chat.</p>}
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {availableFriends.sort((a, b) => (userMap[a.user_id]?.username || a.username).localeCompare(userMap[b.user_id]?.username || b.username)).map(friend => {
                            const isSelected = selectedFriends.includes(friend.user_id);
                            return (
                                <li key={friend.user_id}
                                    onClick={() => onToggleFriend(friend.user_id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', padding: '10px',
                                        cursor: 'pointer', borderRadius: '6px', marginBottom: '5px',
                                        backgroundColor: isSelected ? '#e9f5ff' : '#f9f9f9',
                                        border: isSelected ? '1px solid #007bff' : '1px solid #eee',
                                        transition: 'background-color 0.15s, border-color 0.15s',
                                    }}
                                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f0f0f0'; }}
                                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f9f9f9'; }}
                                >
                                    {renderAvatar(friend.user_id, 32)}
                                    <span style={{ marginLeft: '10px', flexGrow: 1, color: '#333' }}>{userMap[friend.user_id]?.username || friend.username}</span>
                                    {isSelected && <CheckmarkIcon />}
                                </li>
                            );
                        })}
                    </ul>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 15px', borderRadius: '5px', border: '1px solid #ccc',
                            backgroundColor: '#f0f0f0', color: '#333', cursor: 'pointer',
                            fontSize: '0.9em', fontWeight: '500',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={selectedFriends.length === 0}
                        style={{
                            padding: '8px 15px', borderRadius: '5px', border: 'none',
                            backgroundColor: '#28a745', color: 'white', cursor: 'pointer',
                            fontSize: '0.9em', fontWeight: '500',
                            opacity: selectedFriends.length === 0 ? 0.6 : 1,
                        }}
                    >
                        Send Invites ({selectedFriends.length})
                    </button>
                </div>
            </div>
        </div>
    );
};


const ChatComponent = ({ user }) => {

    const { addToast } = useGlobalToasts();

    const [friends, setFriends] = useState([]);
    const [pendingInvites, setPendingInvites] = useState({});
    const [activeChats, setActiveChats] = useState({});
    const [selectedChatId, setSelectedChatId] = useState(null);
    const [messages, setMessages] = useState({});
    const [newMessage, setNewMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState({ friends: false, messages: false });
    const [groupInviteMembers, setGroupInviteMembers] = useState([]);
    const [userMap, setUserMap] = useState({});
    const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
    const [chatToLeaveDetails, setChatToLeaveDetails] = useState(null);

    const [showInviteToChatModal, setShowInviteToChatModal] = useState(false);
    const [chatToInviteFriendsTo, setChatToInviteFriendsTo] = useState(null);
    const [friendsToInviteToExistingChat, setFriendsToInviteToExistingChat] = useState([]);

    const [historyFetchedFor, setHistoryFetchedFor] = useState({});

    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const toastIdCounter = useRef(0);

    const backendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:8080";

    const updateLoading = (key, value) => setLoading((prev) => ({ ...prev, [key]: value }));

    const getUsernamesFromIds = useCallback((userIds, excludeSelf = true) => {
        if (!Array.isArray(userIds) || !userMap) return "Loading...";
        let idsToProcess = userIds;
        if (excludeSelf && user) {
            idsToProcess = userIds.filter(id => id !== user.userId);
        }
        if (idsToProcess.length === 0 && userIds.includes(user?.userId)) {
            return userMap[user.userId]?.username || "Me";
        }
        if (idsToProcess.length === 0) return "Empty Chat";

        const names = idsToProcess.map(id => userMap[id]?.username || `User ${id}`);
        return names.join(", ");
    }, [user, userMap]);


    function addRegionToS3Url(url) {
        if (typeof url !== 'string' || !url.includes('amazonaws.com')) { return url; }
        try {
            const parsed = new URL(url);
            const hostParts = parsed.hostname.split('.');
            const s3Index = hostParts.indexOf('s3');
            const regionPattern = /^[a-z]{2}(-gov)?-[a-z]+-\d$/;

            if (s3Index > -1 && hostParts[s3Index + 1] === 'amazonaws' && hostParts[s3Index + 2] === 'com' && hostParts.length === s3Index + 3) {
                hostParts.splice(s3Index + 1, 0, 'us-east-1');
                parsed.hostname = hostParts.join('.');
                return parsed.toString();
            }
            if (s3Index > -1 && s3Index + 1 < hostParts.length && regionPattern.test(hostParts[s3Index + 1])) {
                return url;
            }
            if (hostParts[0].startsWith('s3-') && regionPattern.test(hostParts[0].substring(3)) && hostParts[1] === 'amazonaws') {
                return url;
            }
        } catch (e) { console.warn("Error parsing S3 URL for region addition:", e); return url; }
        return url;
    }


    const renderAvatar = useCallback((userId, size = 32) => {
        const userData = userMap[userId];
        const baseAvatarStyle = {
            width: `${size}px`, height: `${size}px`, borderRadius: "50%",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: `${Math.max(12, size * 0.45)}px`, fontWeight: "bold", color: "#ffffff",
            backgroundColor: '#bdbdbd', border: `1px solid #eee`, objectFit: "cover",
            flexShrink: 0, fontFamily: 'Arial, sans-serif',
        };
        const colors = ["#007bff", "#6f42c1", "#28a745", "#dc3545", "#fd7e14", "#20c997", "#6610f2", "#17a2b8"];
        const idForColor = Number(userId) || 0;
        if (!userData || !userData.profilePhotoUrl) {
            const hash = String(idForColor).split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
            baseAvatarStyle.backgroundColor = colors[Math.abs(hash) % colors.length];
        }

        let photoUrl = userData?.profilePhotoUrl || userData?.profile_photo_url;
        if (photoUrl) photoUrl = addRegionToS3Url(photoUrl);

        if (photoUrl) {
            return <img src={photoUrl} alt={userData?.username || "User"} style={baseAvatarStyle} />;
        } else {
            const initial = userData?.username ? userData.username.charAt(0).toUpperCase() : (String(idForColor).charAt(0) || "?");
            return <div style={baseAvatarStyle}>{initial}</div>;
        }
    }, [userMap]);

    useEffect(() => {
        const newMap = { ...userMap };
        const updateUserInMap = (ud) => {
            if (ud && ud.id && (!newMap[ud.id] || newMap[ud.id].username !== ud.username || newMap[ud.id].profilePhotoUrl !== ud.profilePhotoUrl)) {
                if (ud.username && !ud.username.startsWith("User ")) {
                    newMap[ud.id] = { id: ud.id, username: ud.username, profilePhotoUrl: ud.profilePhotoUrl };
                } else if (!newMap[ud.id] || newMap[ud.id].username.startsWith("User ")) {
                    newMap[ud.id] = { id: ud.id, username: ud.username, profilePhotoUrl: ud.profilePhotoUrl };
                }
            }
        };

        if (user) updateUserInMap({ id: user.userId, username: user.username, profilePhotoUrl: user.profilePhotoUrl });
        friends.forEach(f => updateUserInMap({ id: f.user_id, username: f.username, profilePhotoUrl: f.profile_photo_url }));
        Object.values(activeChats).forEach(chat => {
            chat.memberDetails?.forEach(member => updateUserInMap(member));
            chat.members?.forEach(memberId => { if (!newMap[memberId]) newMap[memberId] = { id: memberId, username: `User ${memberId}`, profilePhotoUrl: null }; });
        });
        Object.values(pendingInvites).forEach(invite => {
            if (invite.inviterId) updateUserInMap({ id: invite.inviterId, username: invite.inviterUsername, profilePhotoUrl: invite.inviterProfilePhotoUrl });
            if (invite.fromUserId) updateUserInMap({ id: invite.fromUserId, username: invite.senderUsername, profilePhotoUrl: invite.senderProfilePhotoUrl });
            invite.existingMemberIds?.forEach(memberId => { if (!newMap[memberId]) newMap[memberId] = { id: memberId, username: `User ${memberId}`, profilePhotoUrl: null }; });
            if (invite.allInitiallyInvitedUserIds) {
                invite.allInitiallyInvitedUserIds.forEach(memberId => {
                    if (!newMap[memberId]) newMap[memberId] = { id: memberId, username: `User ${memberId}`, profilePhotoUrl: null };
                });
            }
        });
        Object.values(messages).flat().forEach(msg => {
            if (msg.sender_id) updateUserInMap({ id: msg.sender_id, username: msg.senderUsername, profilePhotoUrl: msg.senderProfilePhotoUrl });
        });

        if (Object.keys(newMap).some(key => !userMap[key] || JSON.stringify(userMap[key]) !== JSON.stringify(newMap[key]))) {
            setUserMap(newMap);
        }
    }, [user, friends, activeChats, pendingInvites, messages, userMap]);


    useEffect(() => {
        if (selectedChatId) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, selectedChatId]);

    useEffect(() => {
        if (!user) return;
        axios.get("/api/chat/sessions")
            .then((response) => {
                const chatsData = response.data.activeChats || {};
                setActiveChats(chatsData);
            })
            .catch((err) => {
                console.error("Error fetching active chats:", err);
                addToast({
                    title: "Chat Error",
                    content: `Failed to load chats. ${err.response?.data?.error || ''}`,
                    type: 'error'
                });
            });
    }, [user, addToast]);

    useEffect(() => {
        if (!user) {
            if (socketRef.current) {
                console.log("[Chat Client] No user, disconnecting chat socket.", socketRef.current.id);
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            setFriends([]);
            setPendingInvites({});
            setActiveChats({});
            setSelectedChatId(null);
            setMessages({});
            setGroupInviteMembers([]);
            // setUserMap({}); 
            setError("");
            setHistoryFetchedFor({});
            return;
        }

        if (socketRef.current?.connected && socketRef.current.nsp === '/chat' && socketRef.current.auth?.userId === user.userId) {
            return;
        }

        if (socketRef.current) {
            console.log("[Chat Client] Existing socket found, disconnecting before reconnecting to /chat.", socketRef.current.id, socketRef.current.nsp);
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        console.log(`[Chat Client] Attempting to connect to ${backendUrl}/chat for user ${user.username}`);
        const newSocketInstance = io(`${backendUrl}/chat`, {
            transports: ["websocket"],
            reconnectionAttempts: 5,
            withCredentials: true,
            auth: { userId: user.userId, username: user.username }
        });
        socketRef.current = newSocketInstance;

        newSocketInstance.on("connect", () => {
            console.log(`[Chat Client] Connected to /chat namespace with socket ID: ${newSocketInstance.id}`);
            setError("");
        });

        newSocketInstance.on("disconnect", (reason) => {
            console.log(`[Chat Client] Disconnected from /chat namespace. Reason: ${reason}`);
        });

        newSocketInstance.on("connect_error", (err) => {
            console.error(`[Chat Client] Connection Error to /chat namespace: ${err.message} - Data:`, err.data);
            setError(`Chat connection failed: ${err.message}. Please check your connection or try again later.`);
            addToast({ title: "Connection Error", content: `Chat connection failed: ${err.message}.`, type: 'error', duration: 7000 });
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        });

        // setup chat listeners
        newSocketInstance.on("chatInvite", (invite) => {
            console.log("[Chat Client] Received 'chatInvite'", invite);
            if (invite?.inviteId && invite.fromUserId && invite.memberIds && !pendingInvites[invite.inviteId]) {
                if (invite.toUserId === user.userId) {
                    setPendingInvites((prev) => ({ ...prev, [invite.inviteId]: { ...invite, type: 'new_chat' } }));
                    const inviterName = invite.senderUsername || userMap[invite.fromUserId]?.username || `User ${invite.fromUserId}`;
                    addToast({
                        title: "Chat Invite",
                        content: `You have a new chat invite from ${inviterName}.`,
                        type: 'info'
                    });
                }
            }
        });
        newSocketInstance.on("receivedInviteToExistingChat", (invite) => {
            console.log("[Chat Client] Received 'receivedInviteToExistingChat'", invite);
            if (invite?.inviteId && invite.chatId && invite.inviterId && Array.isArray(invite.existingMemberIds) && !pendingInvites[invite.inviteId]) {
                if (invite.invitedUserId === user.userId) {
                    setPendingInvites(prev => ({ ...prev, [invite.inviteId]: { ...invite, type: 'existing_chat' } }));
                    const inviterName = invite.inviterUsername || userMap[invite.inviterId]?.username || `User ${invite.inviterId}`;
                    const chatParticipantNames = getUsernamesFromIds(invite.existingMemberIds, true);
                    addToast({
                        title: "Group Invite",
                        content: `${inviterName} invited you to join their chat with ${chatParticipantNames}.`,
                        type: 'info'
                    });
                }
            }
        });
        newSocketInstance.on("groupCreationInvite", (invite) => {
            console.log("[Chat Client] Received 'groupCreationInvite'", invite);
            if (invite?.inviteId && invite.chatId && invite.inviterId && Array.isArray(invite.allInitiallyInvitedUserIds) && !pendingInvites[invite.inviteId]) {
                if (invite.invitedUserId === user.userId) {
                    setPendingInvites(prev => ({ ...prev, [invite.inviteId]: { ...invite, type: 'group_creation_invite' } }));
                    const inviterName = invite.inviterUsername || userMap[invite.inviterId]?.username || `User ${invite.inviterId}`;
                    const otherInvitedUsers = invite.allInitiallyInvitedUserIds
                        .filter(id => id !== user?.userId && id !== invite.inviterId)
                        .map(id => userMap[id]?.username || `User ${id}`);
                    let withText = otherInvitedUsers.length > 0 ? ` with ${otherInvitedUsers.slice(0, 2).join(", ")}${otherInvitedUsers.length > 2 ? ` & ${otherInvitedUsers.length - 2} more` : ''}` : "";
                    addToast({
                        title: "New Group Invite",
                        content: `${inviterName} invited you to a new group${withText}.`,
                        type: 'info'
                    });
                }
            }
        });

        newSocketInstance.on("chatMessage", ({ chatId: incomingChatId, message: msgData }) => {
            console.log("[Chat Client] Received 'chatMessage' event from server:", { incomingChatId, msgData });
            if (incomingChatId && msgData?.id) {
                setMessages((prevMessages) => {
                    const currentChatMessages = prevMessages[incomingChatId] || [];
                    let messagesForThisChat = [...currentChatMessages];

                    const optimisticIndex = messagesForThisChat.findIndex(m =>
                        m.isOptimistic &&
                        m.sender_id === msgData.sender_id &&
                        m.message === msgData.message 
                    );

                    if (optimisticIndex > -1) {
                        messagesForThisChat.splice(optimisticIndex, 1);
                        console.log("[Chat Client] Removed optimistic message, will add server confirmed one.");
                    }

                    if (!messagesForThisChat.some((m) => m.id === msgData.id)) {
                        messagesForThisChat.push(msgData);
                        console.log("[Chat Client] Added new confirmed message ID:", msgData.id);
                    } else {
                        messagesForThisChat = messagesForThisChat.map(m => (m.id === msgData.id ? msgData : m));
                        console.log("[Chat Client] Updated existing message ID:", msgData.id);
                    }

                    const sortedMessages = messagesForThisChat.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                    return { ...prevMessages, [incomingChatId]: sortedMessages };
                });

                if (incomingChatId === selectedChatId && msgData.sender_id !== user?.userId) {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                }
            } else {
                console.warn("[Chat Client] Received malformed 'chatMessage':", { incomingChatId, msgData });
            }
        });

        newSocketInstance.on("openExistingChat", ({ chatId, memberIds, chatType, memberDetails }) => {
            console.log("[Chat Client] Received 'openExistingChat'", { chatId, memberIds, chatType, memberDetails });
            setActiveChats((prev) => {
                if (prev[chatId]) return prev;
                return { ...prev, [chatId]: { id: chatId, type: chatType, members: memberIds || [], memberDetails: memberDetails || [] } };
            });
            setSelectedChatId(chatId);
        });
        newSocketInstance.on("newChatSession", (chatSessionData) => {
            console.log("[Chat Client] Received 'newChatSession'", chatSessionData);
            if (chatSessionData?.id && Array.isArray(chatSessionData.members)) {
                setActiveChats((prev) => ({ ...prev, [chatSessionData.id]: chatSessionData }));
            }
        });
        newSocketInstance.on("chatSessionUpdated", (updatedChatSession) => {
            console.log("[Chat Client] Received 'chatSessionUpdated'", updatedChatSession);
            if (updatedChatSession?.id && Array.isArray(updatedChatSession.members)) {
                setActiveChats(prev => ({ ...prev, [updatedChatSession.id]: { ...(prev[updatedChatSession.id] || {}), ...updatedChatSession } }));
            }
        });

        newSocketInstance.on("inviteAccepted", (data) => {
            console.log("[Chat Client] Received 'inviteAccepted'", data);
            if (data.chatSession) {
                const { id, type, members, memberDetails } = data.chatSession;
                setActiveChats((prevActiveChats) => {
                    if (!prevActiveChats[id] || JSON.stringify(prevActiveChats[id].members.slice().sort()) !== JSON.stringify(members.slice().sort())) {
                        return { ...prevActiveChats, [id]: { id, type, members, memberDetails } };
                    }
                    return prevActiveChats;
                });
            }
            if (data.acceptedByUsername) {
                if (data.chatId) {
                    const chatName = activeChats[data.chatId] ? (getUsernamesFromIds(activeChats[data.chatId].members, true) || `chat ID ${data.chatId}`) : `chat ID ${data.chatId}`;
                    addToast({
                        title: "Chat Invite Accepted",
                        content: `${data.acceptedByUsername} accepted your invite and joined ${chatName}.`,
                        type: 'success'
                    })
                } else if (data.chatSession) {
                    addToast({
                        title: "Chat Invite Accepted",
                        content: `${data.acceptedByUsername} accepted your chat invite!`,
                        type:'success'
                    })
                }
            } else if (data.chatSession && data.acceptedByUserId === user.userId) {
            } else if (data.chatSession) {
                addToast({
                    title: "Chat Invite Accepted",
                    content: `${data.acceptedByUsername} accepted your chat invite!`,
                    type:'success'
                })
            }
        });

        newSocketInstance.on("inviteDeclined", ({ inviteId, fromUserId, fromUsername }) => {
            console.log("[Chat Client] Received 'inviteDeclined'", { inviteId, fromUserId, fromUsername });
            const declinerName = fromUsername || userMap[fromUserId]?.username || `User ${fromUserId}`;
            addToast({ title: "Invite Declined", content: `${declinerName} declined your chat invite.`, type: 'info' });
        });

        newSocketInstance.on("existingChatInviteDeclined", ({ message, declinedByUsername, chatId, declinedByUserId }) => {
            console.log("[Chat Client] Received 'existingChatInviteDeclined'", { message, declinedByUsername, chatId });
            addToast({ content: message || `${declinedByUsername || `User ${declinedByUserId}`} declined an invite to chat ${chatId ? `(ID: ${chatId})` : ''}.`, type: 'info' });
        });
        newSocketInstance.on("groupCreationInviteDeclined", ({ chatId, declinedByUserId, declinedByUsername, message }) => {
            console.log("[Chat Client] Received 'groupCreationInviteDeclined'", { chatId, declinedByUsername, message });
            const chatName = activeChats[chatId] ? (getUsernamesFromIds(activeChats[chatId].members, true) || `Group Chat (ID: ${chatId})`) : `Group Chat (ID: ${chatId})`;
            addToast({ content: message || `${declinedByUsername || `User ${declinedByUserId}`} declined to join your new group for ${chatName}.`, type: 'info' });
        });

        newSocketInstance.on("chatError", ({ message: errorMessage }) => {
            console.error("[Chat Client] Received 'chatError':", errorMessage);
            addToast({ title: "Chat Error", content: errorMessage || "An unknown chat error occurred.", type: 'error' });
        });

        return () => {
            console.log(`[Chat Client] Cleaning up chat socket effects for user ${user?.username}. Disconnecting socket ${newSocketInstance.id}`);
            newSocketInstance.off("connect");
            newSocketInstance.off("disconnect");
            newSocketInstance.off("connect_error");
            newSocketInstance.off("chatInvite");
            newSocketInstance.off("receivedInviteToExistingChat");
            newSocketInstance.off("groupCreationInvite");
            newSocketInstance.off("chatMessage");
            newSocketInstance.off("openExistingChat");
            newSocketInstance.off("newChatSession");
            newSocketInstance.off("chatSessionUpdated");
            newSocketInstance.off("inviteAccepted");
            newSocketInstance.off("inviteDeclined");
            newSocketInstance.off("existingChatInviteDeclined");
            newSocketInstance.off("groupCreationInviteDeclined");
            newSocketInstance.off("chatError");

            newSocketInstance.disconnect();
            if (socketRef.current && socketRef.current.id === newSocketInstance.id) {
                socketRef.current = null;
            }
        };
    }, [user, backendUrl, addToast, getUsernamesFromIds, pendingInvites, userMap, activeChats]);


    useEffect(() => {
        if (!user) return;
        updateLoading("friends", true);
        axios.get(`/api/chat/friends`)
            .then((response) => setFriends(response.data.friends || []))
            .catch((err) => {  addToast({ title: "Error", content: `Failed to fetch friends. ${err.response?.data?.error || ''}`, type: 'error' }); setFriends([]); })
            .finally(() => updateLoading("friends", false));
    }, [user, addToast]);

    useEffect(() => {
        if (!selectedChatId || !user) {
            return;
        }
        if (!historyFetchedFor[selectedChatId]) {
            updateLoading("messages", true);
            axios.get(`/api/chat/${selectedChatId}/messages`)
                .then((response) => {
                    const fetchedMessages = response.data.messages || [];
                    setMessages((prevMessagesState) => {
                        const currentChatLiveMessages = prevMessagesState[selectedChatId] || [];
                        const fetchedMessageIds = new Set(fetchedMessages.map(m => m.id));
                        const uniqueLiveMessagesNotInHistory = currentChatLiveMessages.filter(
                            m => !fetchedMessageIds.has(m.id)
                        );
                        const combinedMessages = [...fetchedMessages, ...uniqueLiveMessagesNotInHistory];
                        return {
                            ...prevMessagesState,
                            [selectedChatId]: combinedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                        };
                    });
                    setHistoryFetchedFor(prev => ({ ...prev, [selectedChatId]: true }));
                })
                .catch((err) => {
                    addToast({ title: "Error", content: `Failed to fetch messages for chat. ${err.response?.data?.error || ''}`, type: 'error' });
                })
                .finally(() => {
                    updateLoading("messages", false);
                });
        }
    }, [selectedChatId, user, addToast, historyFetchedFor]);


    const handleChatButtonClick = (friendId) => {
        if (!user) return;
        const existingChat = Object.values(activeChats).find(
            (chat) => chat.type === "private" && chat.members.length === 2 &&
                chat.members.includes(user.userId) && chat.members.includes(friendId)
        );
        if (existingChat) {
            setSelectedChatId(existingChat.id);
        } else {
            sendChatInvite(friendId);
        }
    };

    const sendChatInvite = (toUserId) => {
        if (!user || !socketRef.current?.connected) { addToast({ content: "Chat not connected.", type: 'error' }); return; }

        socketRef.current.emit("sendChatInvite", { toUserId }, (response) => {
            if (response?.success) {

                if (response.chatId && response.message === 'Chat already exists.') {
                    addToast({ content: `Chat with ${userMap[toUserId]?.username || "this user"} already exists. Opening it.`, type: 'info' });
                    if (!activeChats[response.chatId]) {
                        axios.get("/api/chat/sessions").then(r => setActiveChats(r.data.activeChats || {})).catch(e => console.error("Refetch error", e));
                    }
                    setSelectedChatId(response.chatId);
                } else if (response.inviteId) {
                    addToast({ content: `Invite sent to ${userMap[toUserId]?.username || "friend"}!`, type: 'success' });
                }
            } else addToast({ title: "Invite Failed", content: `Failed to send invite: ${response?.error || "Unknown error."}`, type: 'error' });
        });
    };

    const handleGroupInvite = async () => {
        if (!user || groupInviteMembers.length === 0 || !socketRef.current?.connected) { 
            addToast({
                title: "Invite Failed",
                content: `Select friends to invite`,
                type: 'error'
            })
            return; 
        }

        socketRef.current.emit("sendGroupChatInvite", { memberIds: groupInviteMembers }, (response) => {
            if (response?.success && response.chatSessionId) {
                const invitedUsernames = groupInviteMembers.map(id => userMap[id]?.username || `User ${id}`);
                if (groupInviteMembers.length > 0 && response.message !== 'Self-group chat already exists.') {
                    addToast({ content: `Invites sent for new group with ${invitedUsernames.join(', ')}!`, type: 'success' });
                } else if (response.message === 'Self-group chat already exists.') {
                    addToast({ content: response.message, type: 'info' });
                }
                else {
                    addToast({ content: `Personal group chat created!`, type: 'success' });
                }
                setGroupInviteMembers([]);

                if (response.chatSessionData) {
                    setActiveChats((prev) => ({ ...prev, [response.chatSessionData.id]: response.chatSessionData }));
                }
                setSelectedChatId(response.chatSessionId);
            } else  addToast({ title: "Group Creation Failed", content: `Failed to create group/send invites: ${response?.error || "Unknown error."}`, type: 'error' });
        });
    };

    const handleInviteResponse = async (inviteId, accept) => {
        if (!user || !socketRef.current?.connected) { addToast({ content: "Chat not connected.", type: 'error' }); return; }
        const invite = pendingInvites[inviteId];
        if (!invite) { addToast({ content: "Invite not found.", type: 'warning' }); return; }

        socketRef.current.emit("respondToInvite", { inviteId, accept }, (response) => {
            if (response?.success) {
                setPendingInvites((prev) => { const ni = { ...prev }; delete ni[inviteId]; return ni; });
                if (accept && response.chatSession) {
                    const cs = response.chatSession;
                    setActiveChats(prevActiveChats => {
                        return { ...prevActiveChats, [cs.id]: { ...(prevActiveChats[cs.id] || {}), ...cs } };
                    });
                    setSelectedChatId(cs.id);
                    const chatName = getUsernamesFromIds(cs.members, true);
                    addToast({ content: `Joined chat with ${chatName}`, type: 'success' });
                } else if (accept) {
                    addToast({ content: "Invite accepted. Waiting for chat details...", type: 'info' });
                } else {
                    addToast({ content: response.message || "Invite declined.", type: 'info' });
                }
            } else {
                if (response?.error?.includes("Invite not found")) {
                    setPendingInvites((prev) => { const ni = { ...prev }; delete ni[inviteId]; return ni; });
                }
                addToast({ title: "Response Failed", content: `Failed to respond: ${response?.error || "Unknown error."}`, type: 'error' });
            }
        });
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!user || !selectedChatId || !newMessage.trim() || !socketRef.current?.connected) return;
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const optimisticMsg = {
            id: tempId, chat_id: selectedChatId, sender_id: user.userId,
            message: newMessage, timestamp: new Date().toISOString(), isOptimistic: true, type: 'user',
            senderUsername: userMap[user.userId]?.username || user.username,
            senderProfilePhotoUrl: userMap[user.userId]?.profilePhotoUrl || user.profilePhotoUrl
        };
        setMessages(prev => {
            const currentChatMessages = prev[selectedChatId] || [];
            const updatedMessages = [...currentChatMessages, optimisticMsg].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            return { ...prev, [selectedChatId]: updatedMessages };
        });
        const currentMsgText = newMessage; setNewMessage("");

        socketRef.current.emit("sendMessage", { chatId: selectedChatId, message: currentMsgText }, (response) => {
            if (response?.success && response.persistedMessage) {
                setMessages(prev => {
                    const chatMessages = (prev[selectedChatId] || []).filter(m => m.id !== tempId);
                    return { ...prev, [selectedChatId]: chatMessages };
                });
            } else {
                addToast({ title: "Send Failed", content: `Message failed: ${response?.error || "Server did not confirm."}`, type: 'error' });
                setMessages(prev => ({
                    ...prev,
                    [selectedChatId]: (prev[selectedChatId] || []).map(m =>
                        m.id === tempId ? { ...m, hasError: true, isOptimistic: false } : m
                    )
                }));
                setNewMessage(currentMsgText);
            }
        });
    };

    const triggerLeaveChat = () => {
        if (!user || !selectedChatId || !activeChats[selectedChatId]) return;
        const chatName = getUsernamesFromIds(activeChats[selectedChatId].members, true);
        setChatToLeaveDetails({ id: selectedChatId, name: chatName }); setShowLeaveConfirmModal(true);
    };

    const confirmLeaveChat = async () => {
        if (!chatToLeaveDetails) return;
        const { id: chatToLeaveId } = chatToLeaveDetails;

        const oldSelectedChatId = selectedChatId;

        setShowLeaveConfirmModal(false);
        setChatToLeaveDetails(null);

        try {
            await axios.post(`/api/chat/${chatToLeaveId}/leave`);
            addToast({ content: `You have left the chat`, type: 'info' });

            setActiveChats((prev) => { const ns = { ...prev }; delete ns[chatToLeaveId]; return ns; });
            setMessages((prev) => { const ns = { ...prev }; delete ns[chatToLeaveId]; return ns; });
            setHistoryFetchedFor((prev) => { const ns = { ...prev }; delete ns[chatToLeaveId]; return ns; });

            if (oldSelectedChatId === chatToLeaveId) {
                setSelectedChatId(null);
            }

        } catch (err) {
            addToast({ title: "Error Leaving Chat", content: `Failed to leave: ${err.response?.data?.error || err.message}`, type: 'error' });
            axios.get("/api/chat/sessions").then(r => setActiveChats(r.data.activeChats || {})).catch(e => console.error("Refetch error after failed leave", e));
        }
    };

    const toggleGroupInviteMember = (friendId) => setGroupInviteMembers(prev => prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]);

    const openInviteToChatModal = (chatId) => {
        const chat = activeChats[chatId];
        if (!chat || !user) { addToast("Chat/user details missing.", 'error'); return; }
        setChatToInviteFriendsTo({ chatId, currentMembers: chat.members, displayMembers: chat.members.filter(id => id !== user.userId) });
        setFriendsToInviteToExistingChat([]); setShowInviteToChatModal(true);
    };

    const toggleFriendForExistingChatInvite = (friendId) => setFriendsToInviteToExistingChat(prev => prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]);

    const handleSendInvitesToExistingChat = () => {
        if (!chatToInviteFriendsTo || friendsToInviteToExistingChat.length === 0 || !socketRef.current?.connected) { 
            addToast({ content: "Select friends & ensure chat connected.", type: 'warning' });
            return; 
        }
        socketRef.current.emit("sendInvitesToExistingChat", { chatId: chatToInviteFriendsTo.chatId, invitedUserIds: friendsToInviteToExistingChat }, (response) => {
            if (response?.results) {
                let allOk = true;
                response.results.forEach(res => {
                    const fName = userMap[res.userId]?.username || `User ${res.userId}`;
                    if (res.success) addToast({ content: `Invite sent to ${fName}.`, type: 'success', duration: 2000 });
                    else { 
                        addToast({ title: "Invite Error", content: `Failed to invite ${fName}: ${res.error || 'Unknown.'}`, type: 'error' });
                        allOk = false; 
                    }
                });
                if (response.message && (response.results.length || !allOk)) addToast({ content: response.message, type: allOk && response.success ? 'info' : 'warning' });
            } else if (response?.success) addToast({ content: response.message || "Invites sent!", type: 'success' });
            else addToast({ title: "Invite Failed", content: `Invites failed: ${response?.error || "Unknown."}`, type: 'error' });
            setShowInviteToChatModal(false); setFriendsToInviteToExistingChat([]); setChatToInviteFriendsTo(null);
        });
    };

    const renderChatInterface = () => (
        <>
            <div style={{
                width: '100%', padding: '12px 24px', backgroundColor: '#f8f9fa',
                color: '#343a40', fontSize: '1.1em', fontWeight: 600, boxSizing: 'border-box',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', borderBottom: '1px solid #dee2e6', height: '60px'
            }}>
                <span>Chatterbox</span>
                {user && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {renderAvatar(user.userId, 28)}
                        <span style={{ fontSize: '0.9em', color: '#495057' }}>{userMap[user.userId]?.username || user.username}</span>
                    </div>
                )}
            </div>

            <div style={{
                display: 'flex', height: 'calc(100% - 60px)',
                overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', backgroundColor: '#f0f2f5',
            }}>
                {/* Left Panel */}
                <div style={{
                    width: '320px', minWidth: '280px', borderRight: '1px solid #dadce0',
                    display: 'flex', flexDirection: 'column', backgroundColor: '#fff', overflowY: 'hidden',
                }}>
                    {Object.keys(pendingInvites).length > 0 && (
                        <div style={{ padding: '15px', borderBottom: '1px solid #e0e0e0', flexShrink: 0 }}>
                            <h3 style={{ margin: '0 0 10px 0', fontSize: '0.95em', color: '#333', fontWeight: 600 }}>
                                Pending Invites ({Object.keys(pendingInvites).length})
                            </h3>
                            <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: '150px', overflowY: 'auto' }}>
                                {Object.values(pendingInvites).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(invite => {
                                    let inviteContent, avatarForInvite, primaryName;
                                    if (invite.type === 'existing_chat') {
                                        avatarForInvite = invite.inviterId;
                                        primaryName = userMap[invite.inviterId]?.username || invite.inviterUsername || `User ${invite.inviterId}`;
                                        const otherExistingMembers = (invite.existingMemberIds || []).filter(id => id !== user?.userId && id !== invite.inviterId);
                                        const chatMembersDesc = otherExistingMembers.length > 0 ? getUsernamesFromIds(otherExistingMembers, false) : "an existing group";
                                        inviteContent = (
                                            <div style={{ flexGrow: 1, fontSize: '0.85em', color: '#454545', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                <div style={{ fontWeight: '500' }}>{primaryName}</div>
                                                <div style={{ fontSize: '0.9em', color: '#666' }}>Invites you to join:</div>
                                                <div style={{ fontSize: '0.9em', color: '#666', fontStyle: 'italic', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chatMembersDesc}</div>
                                            </div>
                                        );
                                    } else if (invite.type === 'group_creation_invite') {
                                        avatarForInvite = invite.inviterId;
                                        primaryName = userMap[invite.inviterId]?.username || invite.inviterUsername || `User ${invite.inviterId}`;
                                        const otherInvitees = (invite.allInitiallyInvitedUserIds || [])
                                            .filter(id => id !== user?.userId && id !== invite.inviterId)
                                            .map(id => userMap[id]?.username || `User ${id}`);
                                        let withText = "";
                                        if (otherInvitees.length > 0) {
                                            withText = ` with ${otherInvitees.slice(0, 2).join(', ')}`;
                                            if (otherInvitees.length > 2) withText += ` & ${otherInvitees.length - 2} more`;
                                        }
                                        inviteContent = (
                                            <div style={{ flexGrow: 1, fontSize: '0.85em', color: '#454545', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                <div style={{ fontWeight: '500' }}>{primaryName}</div>
                                                <div style={{ fontSize: '0.9em', color: '#666' }}>Invites you to a new group{withText}.</div>
                                            </div>
                                        );
                                    } else {
                                        avatarForInvite = invite.fromUserId;
                                        primaryName = userMap[invite.fromUserId]?.username || invite.senderUsername || `User ${invite.fromUserId}`;
                                        inviteContent = (
                                            <span style={{ flexGrow: 1, fontSize: '0.9em', color: '#454545', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}> From: {primaryName} </span>
                                        );
                                    }
                                    return (
                                        <li key={invite.inviteId} style={{ display: 'flex', alignItems: 'center', padding: '8px 5px', borderBottom: '1px solid #f0f0f0', gap: '10px' }}>
                                            {renderAvatar(avatarForInvite, 36)}
                                            {inviteContent}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                                                <button onClick={() => handleInviteResponse(invite.inviteId, true)} style={{ border: 'none', background: '#28a745', color: 'white', cursor: 'pointer', padding: '4px 8px', fontSize: '0.75em', borderRadius: '4px', fontWeight: 500 }} > Accept </button>
                                                <button onClick={() => handleInviteResponse(invite.inviteId, false)} style={{ border: 'none', background: '#dc3545', color: 'white', cursor: 'pointer', padding: '4px 8px', fontSize: '0.75em', borderRadius: '4px', fontWeight: 500 }} > Reject </button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                    <div style={{ padding: '15px', borderBottom: '1px solid #e0e0e0', flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '0.95em', color: '#333', fontWeight: 600 }}> Active Chats </h3>
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0, flexGrow: 1, overflowY: 'auto' }}>
                            {Object.keys(activeChats).length === 0 && (<li style={{ padding: '15px', textAlign: 'center', color: '#777', fontSize: '0.9em' }} > No active chats. </li>)}
                            {Object.values(activeChats)
                                .sort((a, b) => (getUsernamesFromIds(a.members, false) || '').localeCompare(getUsernamesFromIds(b.members, false) || ''))
                                .map(chat => {
                                    let avatarUserId = null, displayName = "Chat";
                                    const otherMembers = chat.members.filter(id => id !== user?.userId);
                                    if (chat.type === 'private') {
                                        if (otherMembers.length > 0) { avatarUserId = otherMembers[0]; displayName = userMap[avatarUserId]?.username || `User ${avatarUserId}`; }
                                        else { avatarUserId = user?.userId; displayName = (userMap[user?.userId]?.username || "Me") + " (Notes)"; }
                                    } else if (chat.type === 'group') {
                                        const displayMembers = chat.members.length === 1 && chat.members[0] === user?.userId ? [user?.userId] : otherMembers;
                                        displayName = "Group: " + displayMembers.map(id => userMap[id]?.username?.split(' ')[0] || `User ${id}`).slice(0, 2).join(', ');
                                        if (displayMembers.length > 2) displayName += ` & ${displayMembers.length - 2} more`;
                                        else if (displayMembers.length === 0 && chat.members.includes(user?.userId)) displayName = (userMap[user?.userId]?.username || "Me") + " (Self Group)";
                                        else if (displayMembers.length === 0) displayName = "Empty Group";
                                        if (chat.members.length === 1 && chat.members[0] === user?.userId) avatarUserId = user?.userId;
                                    } else { avatarUserId = chat.members.length > 0 ? chat.members[0] : null; displayName = "Unknown Chat"; }
                                    const isSelected = chat.id === selectedChatId;
                                    return (
                                        <li key={chat.id} onClick={() => setSelectedChatId(chat.id)} style={{
                                            display: 'flex', alignItems: 'center', padding: '10px 8px', gap: '12px', cursor: 'pointer',
                                            backgroundColor: isSelected ? '#e9ecef' : 'transparent', borderBottom: '1px solid #f0f0f0',
                                            borderRadius: '6px', marginBottom: '3px', transition: 'background-color 0.15s ease-in-out',
                                        }}
                                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f8f9fa' }}
                                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }} >
                                            {avatarUserId ? renderAvatar(avatarUserId, 40) : (
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#007bff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: 'white', fontWeight: 'bold', flexShrink: 0 }}>
                                                    {chat.members.length || '?'}
                                                </div>
                                            )}
                                            <span style={{ flexGrow: 1, fontSize: '0.9em', color: isSelected ? '#0056b3' : '#333', fontWeight: isSelected ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} > {displayName} </span>
                                        </li>);
                                })}
                        </ul>
                    </div>
                    <div style={{ padding: '15px', borderTop: '1px solid #e0e0e0', maxHeight: 'calc(40% - 15px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '0.95em', color: '#333', fontWeight: 600 }}> Friends ({friends.length}) </h3>
                        {loading.friends && (<p style={{ fontSize: '0.85em', color: '#888', margin: '8px 0' }}>Loading...</p>)}
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0, flexGrow: 1, overflowY: 'auto', }}>
                            {friends.length === 0 && !loading.friends && (<li style={{ padding: '10px 0', textAlign: 'center', color: '#777', fontSize: '0.9em' }} > No friends. </li>)}
                            {friends.sort((a, b) => (userMap[a.user_id]?.username || a.username).localeCompare(userMap[b.user_id]?.username || b.username)).map(friend => {
                                const isSelectedForGroup = groupInviteMembers.includes(friend.user_id);
                                return (
                                    <li key={friend.user_id} onClick={() => toggleGroupInviteMember(friend.user_id)} style={{
                                        display: 'flex', alignItems: 'center', padding: '8px 10px', gap: '10px',
                                        borderBottom: '1px solid #f0f0f0', borderRadius: '6px', marginBottom: '3px', cursor: 'pointer',
                                        backgroundColor: isSelectedForGroup ? '#e9f5ff' : 'transparent', transition: 'background-color 0.15s ease',
                                    }}
                                        onMouseEnter={e => { if (!isSelectedForGroup) e.currentTarget.style.backgroundColor = '#f8f9fa' }}
                                        onMouseLeave={e => { if (!isSelectedForGroup) e.currentTarget.style.backgroundColor = 'transparent' }}
                                    >
                                        {renderAvatar(friend.user_id, 36)}
                                        <span style={{ flexGrow: 1, fontSize: '0.9em', color: '#454545', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}> {userMap[friend.user_id]?.username || friend.username} </span>
                                        {isSelectedForGroup && <CheckmarkIcon />}
                                        <button onClick={(e) => { e.stopPropagation(); handleChatButtonClick(friend.user_id); }}
                                            disabled={!socketRef.current?.connected} title={!socketRef.current?.connected ? "Chat offline" : `Chat with ${userMap[friend.user_id]?.username || friend.username}`}
                                            style={{ border: '1px solid #007bff', color: '#007bff', background: 'transparent', cursor: socketRef.current?.connected ? 'pointer' : 'not-allowed', opacity: socketRef.current?.connected ? 1 : 0.6, padding: '5px 10px', fontSize: '0.8em', borderRadius: '4px', fontWeight: 500, marginLeft: 'auto', flexShrink: 0 }}
                                            onMouseEnter={e => { if (socketRef.current?.connected) { e.currentTarget.style.backgroundColor = '#007bff'; e.currentTarget.style.color = '#fff'; } }}
                                            onMouseLeave={e => { if (socketRef.current?.connected) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#007bff'; } }}
                                        > Chat </button>
                                    </li>
                                )
                            })}
                        </ul>
                        {friends.length > 0 && (
                            <button onClick={handleGroupInvite} disabled={!socketRef.current?.connected}
                                style={{ marginTop: '12px', width: '100%', padding: '10px', fontSize: '0.9em', fontWeight: 600, borderRadius: '6px', border: 'none', backgroundColor: socketRef.current?.connected ? '#28a745' : '#adb5bd', color: '#fff', cursor: socketRef.current?.connected ? 'pointer' : 'not-allowed' }}
                            > Create Group Chat {groupInviteMembers.length > 0 ? `(${groupInviteMembers.length}) ` : ''} </button>
                        )}
                    </div>
                </div>
                <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f0f2f5' }} >
                    {selectedChatId && activeChats[selectedChatId] ? renderChatWindow() : renderChatPlaceholder()}
                </div>
            </div>
        </>
    );
    const renderChatPlaceholder = () => (
        <div style={{
            flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            color: "#6c757d", textAlign: "center", padding: "20px", backgroundColor: '#e9ecef',
            height: '100%', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#adb5bd" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '25px' }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <div style={{ fontSize: "1.4em", marginBottom: "12px", color: '#495057', fontWeight: 500 }}>Your Messages</div>
            <div style={{ fontSize: "1em", color: "#6c757d" }}> Select a chat or start a new one with your friends. </div>
        </div>
    );

    const renderChatWindow = () => {
        const currentChat = activeChats[selectedChatId];
        const chatMessages = messages[selectedChatId] || [];
        if (!currentChat) return <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#777', height: '100%', backgroundColor: '#fff' }}>Loading chat...</div>;

        let headerAvatarUserId = null; let chatTitle = "Chat";
        const otherMembers = currentChat.members.filter(id => id !== user?.userId);

        if (currentChat.type === "private") {
            if (otherMembers.length > 0) { headerAvatarUserId = otherMembers[0]; chatTitle = userMap[headerAvatarUserId]?.username || `User ${headerAvatarUserId}`; }
            else { headerAvatarUserId = user?.userId; chatTitle = (userMap[user?.userId]?.username || "Me") + " (Notes)"; }
        } else if (currentChat.type === "group") {
            const displayMembers = currentChat.members.filter(id => id !== user?.userId);
            if (displayMembers.length > 0) {
                chatTitle = "Group: " + displayMembers.map(id => userMap[id]?.username?.split(' ')[0] || `User ${id}`).slice(0, 3).join(', ');
                if (displayMembers.length > 3) chatTitle += ` & ${displayMembers.length - 3} more`;
                if (currentChat.members.length === 1 && currentChat.members[0] === user?.userId) { 
                    headerAvatarUserId = user?.userId;
                }
            } else if (currentChat.members.includes(user?.userId)) { 
                chatTitle = (userMap[user?.userId]?.username || "Me") + " (Self Group)";
                headerAvatarUserId = user?.userId; 
            } else { 
                chatTitle = "Empty Group";
            }
        }


        return (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                <div style={{
                    padding: "10px 15px", borderBottom: "1px solid #d1d7dc", display: "flex",
                    justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8f9fa",
                    height: '60px', flexShrink: 0
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "500", fontSize: "1.0em", color: '#212529', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {headerAvatarUserId ? renderAvatar(headerAvatarUserId, 32) : currentChat.type === "group" && (
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#6c757d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: 'white', fontWeight: 'bold', flexShrink: 0 }}>
                                {currentChat.members.length}
                            </div>
                        )}
                        <span title={chatTitle}>{chatTitle}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {currentChat.type === 'group' && currentChat.members.includes(user?.userId) && (
                            <button
                                onClick={() => openInviteToChatModal(selectedChatId)}
                                disabled={!socketRef.current?.connected}
                                title={"Invite friends to this group chat"}
                                style={{ padding: "6px 12px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "0.8em", fontWeight: "500", opacity: !socketRef.current?.connected ? 0.6 : 1 }}
                            > Invite </button>
                        )}
                        {currentChat.members.includes(user?.userId) && (
                            <button onClick={triggerLeaveChat} style={{ padding: "6px 12px", backgroundColor: "transparent", color: "#dc3545", border: "1px solid #dc3545", borderRadius: "5px", cursor: "pointer", fontSize: "0.8em", fontWeight: "500" }} title="Leave chat" > Leave </button>
                        )}
                    </div>
                </div>
                <div style={{ flexGrow: 1, overflowY: "auto", padding: "15px", display: "flex", flexDirection: "column", backgroundColor: '#ffffff' }}>
                    {loading.messages && (<p style={{ textAlign: "center", color: "#6c757d", fontSize: '0.9em', padding: '20px' }}>Loading messages...</p>)}
                    {!loading.messages && chatMessages.length === 0 && currentChat.members.length > 1 && (<p style={{ textAlign: "center", color: "#868e96", fontSize: '0.9em', padding: '20px' }}>No messages. Say hello!</p>)}
                    {!loading.messages && chatMessages.length === 0 && currentChat.members.length === 1 && currentChat.members[0] === user?.userId && (<p style={{ textAlign: "center", color: "#868e96", fontSize: '0.9em', padding: '20px' }}>This is your personal space or a newly created group. Invites have been sent if applicable. Messages will appear here.</p>)}

                    {chatMessages.map((msg) => {
                        const isMyMessage = msg.sender_id === user?.userId;
                        if (msg.type === 'system') {
                            return (
                                <div key={msg.id || `system-${msg.timestamp}`} style={{ textAlign: 'center', color: '#6c757d', fontSize: '0.85em', margin: '10px 0px 15px', fontStyle: 'italic', padding: '3px 8px', backgroundColor: '#f0f2f5', borderRadius: '10px', alignSelf: 'center', maxWidth: '80%' }}>
                                    {msg.message}
                                    <span style={{ fontSize: "0.7rem", color: "#aaa", marginLeft: "8px", display: 'block', marginTop: '2px' }}>
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                    </span>
                                </div>);
                        }
                        return (
                            <div key={msg.id || `optimistic-${msg.timestamp}`} style={{ display: "flex", marginBottom: "10px", maxWidth: "75%", alignSelf: isMyMessage ? "flex-end" : "flex-start", flexDirection: isMyMessage ? "row-reverse" : "row", alignItems: 'flex-end', gap: '8px' }}>
                                {!isMyMessage && (currentChat.type === 'group' || (currentChat.type === 'private' && currentChat.members.length > 1)) && (
                                    <div style={{ flexShrink: 0, alignSelf: 'flex-start', marginTop: currentChat.type === 'group' && !isMyMessage ? '18px' : '0px' }}>
                                        {renderAvatar(msg.sender_id, 28)}
                                    </div>)}
                                <div style={{ padding: "8px 14px", borderRadius: "18px", wordWrap: "break-word", fontSize: "0.95rem", lineHeight: "1.4", position: "relative", backgroundColor: isMyMessage ? "#007aff" : "#e9e9eb", color: isMyMessage ? "white" : "black", boxShadow: '0 1px 1px rgba(0,0,0,0.05)', opacity: msg.isOptimistic ? 0.7 : (msg.hasError ? 0.8 : 1), borderTopLeftRadius: isMyMessage ? '18px' : '5px', borderTopRightRadius: isMyMessage ? '5px' : '18px', border: msg.hasError ? '1px solid #dc3545' : 'none' }}>
                                    {currentChat.type === "group" && !isMyMessage && (<span style={{ fontSize: "0.75em", color: "#666", marginBottom: "3px", display: "block", fontWeight: "500", }}> {userMap[msg.sender_id]?.username || `User ${msg.sender_id}`} </span>)}
                                    <span style={{ display: 'block', color: msg.hasError ? (isMyMessage ? '#ffdddd' : '#d9534f') : 'inherit' }}>
                                        {msg.message}
                                        {msg.hasError && <span style={{ fontSize: '0.8em', marginLeft: '5px', fontWeight: 'bold' }}>(Failed)</span>}
                                    </span>
                                    <span style={{ fontSize: "0.7rem", color: isMyMessage ? "#e0e0e0" : "#888", display: "block", textAlign: "right", clear: "both", marginTop: "4px" }}> {new Date(msg.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} </span>
                                </div>
                            </div>);
                    })}
                    <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSendMessage} style={{ display: "flex", padding: "10px 12px", borderTop: "1px solid #d1d7dc", backgroundColor: "#f8f9fa", alignItems: "center", gap: '8px', flexShrink: 0, height: '60px' }}>
                    <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Message..." disabled={!socketRef.current?.connected || !selectedChatId || !activeChats[selectedChatId]?.members.includes(user?.userId)} style={{ flexGrow: 1, padding: "10px 15px", border: "1px solid #ced4da", borderRadius: "20px", fontSize: "0.95em", outline: "none", backgroundColor: '#fff' }} />
                    <button type="submit" disabled={!newMessage.trim() || !socketRef.current?.connected || !selectedChatId || !activeChats[selectedChatId]?.members.includes(user?.userId)} style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', backgroundColor: (!newMessage.trim() || !socketRef.current?.connected || !selectedChatId || !activeChats[selectedChatId]?.members.includes(user?.userId)) ? "#adb5bd" : "#007aff", color: "#fff", display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (!newMessage.trim() || !socketRef.current?.connected || !selectedChatId || !activeChats[selectedChatId]?.members.includes(user?.userId)) ? "not-allowed" : "pointer", transition: "background-color 0.2s", flexShrink: 0 }} > <SendIcon active={!!(newMessage.trim() && socketRef.current?.connected && selectedChatId && activeChats[selectedChatId]?.members.includes(user?.userId))} /> </button>
                </form>
            </div>);
    };

    return (
        <div style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
            padding: "0", maxWidth: "1000px", minWidth: "700px",
            margin: "20px auto", border: "1px solid #d1d1d1", borderRadius: "8px",
            backgroundColor: "#fff", height: "calc(100vh - 40px)", minHeight: "600px",
            display: "flex", flexDirection: "column", boxShadow: '0 4px 12px rgba(0,0,0,0.08)', overflow: 'hidden',
        }}>
            <ConfirmationModal isOpen={showLeaveConfirmModal} onClose={() => { setShowLeaveConfirmModal(false); setChatToLeaveDetails(null); }} onConfirm={confirmLeaveChat} title="Leave Chat" >
                Are you sure you want to leave the chat with <strong>{chatToLeaveDetails?.name || 'this chat'}</strong>?
            </ConfirmationModal>
            <InviteToChatModal isOpen={showInviteToChatModal} onClose={() => { setShowInviteToChatModal(false); setChatToInviteFriendsTo(null); setFriendsToInviteToExistingChat([]); }} onConfirm={handleSendInvitesToExistingChat}
                title={`Invite to: ${chatToInviteFriendsTo && activeChats[chatToInviteFriendsTo.chatId] ? (getUsernamesFromIds(activeChats[chatToInviteFriendsTo.chatId].members.filter(id => id !== user?.userId), false).substring(0, 25) + (getUsernamesFromIds(activeChats[chatToInviteFriendsTo.chatId].members.filter(id => id !== user?.userId), false).length > 25 ? '...' : '')) : 'Chat'}`}
                friends={friends} currentChatMembers={chatToInviteFriendsTo?.currentMembers || []} selectedFriends={friendsToInviteToExistingChat} onToggleFriend={toggleFriendForExistingChatInvite} userMap={userMap} renderAvatar={renderAvatar} >
                <p style={{ fontSize: '0.9em', color: '#666', marginTop: '-10px', marginBottom: '15px', textAlign: 'center' }}> Select friends to invite to this group chat. </p>
            </InviteToChatModal>
            {error && (
                <div style={{ color: "#721c24", padding: "10px 15px", margin: "0", backgroundColor: "#f8d7da", borderBottom: "1px solid #f5c6cb", textAlign: "center", fontSize: "0.9em", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', flexShrink: 0 }}>
                    {error} <span onClick={() => setError("")} style={{ cursor: 'pointer', fontWeight: 'bold', marginLeft: '15px' }}>X</span>
                </div>)}
            {renderChatInterface()}
        </div>
    );
};

export default ChatComponent;