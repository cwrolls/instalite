import db from '../db.js'; 

const onlineUsers = new Map();
const pendingInvitesStore = {};

// fetches user details from db
export async function fetchUserDetails(userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
        return [];
    }
    const uniqueUserIds = Array.from(new Set(userIds.filter(id => id != null && !isNaN(parseInt(id))))).map(id => parseInt(id));
    if (uniqueUserIds.length === 0) {
        return [];
    }

    const placeholders = uniqueUserIds.map(() => '?').join(',');
    const sql = `SELECT user_id, username, first_name, last_name, email, profile_photo_url FROM users WHERE user_id IN (${placeholders})`;
    try {
        const [rows] = await db.query(sql, uniqueUserIds);
        return rows.map(row => ({
            id: row.user_id,
            username: row.username,
            firstName: row.first_name,
            lastName: row.last_name,
            email: row.email,
            profilePhotoUrl: row.profile_photo_url
        }));
    } catch (error) {
        console.error("Error fetching user details for CHAT (IDs):", uniqueUserIds, error);
        return uniqueUserIds.map(id => ({
            id: id,
            username: `User ${id}`,
            firstName: `User`,
            lastName: `${id}`,
            email: null,
            profilePhotoUrl: null
        }));
    }
}

// init chat socket 
export function initializeSocketIO(mainIoServer, sessionMiddleware) {
    const chatNamespace = mainIoServer.of('/chat');

    const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
    chatNamespace.use(wrap(sessionMiddleware));


    chatNamespace.on('connection', (socket) => {
        const session = socket.request.session;
        const user = session?.user;
        const userId = user?.userId;

        if (userId) {
            console.log(`[Chat Socket ${socket.id}] Connected: User ${user.username} (ID: ${userId}) to /chat namespace.`);
            onlineUsers.set(userId, socket.id); 

            Object.values(pendingInvitesStore).forEach(invite => {
                if (invite.type === 'new_chat' && invite.toUserId === userId) {
                    socket.emit('chatInvite', invite); 
                } else if (invite.type === 'existing_chat' && invite.invitedUserId === userId) {
                    socket.emit('receivedInviteToExistingChat', invite); 
                } else if (invite.type === 'group_creation_invite' && invite.invitedUserId === userId) {
                    socket.emit('groupCreationInvite', invite); 
                }
            });


            socket.on('sendChatInvite', async (data, callback) => {
                if (!data || !data.toUserId) {
                    return callback?.({ success: false, error: 'Recipient user ID missing.' });
                }
                const fromUserId = userId;
                const toUserId = parseInt(data.toUserId, 10);

                if (fromUserId === toUserId) {
                    return callback?.({ success: false, error: 'Cannot invite yourself to a new private chat this way.' });
                }

                const existingPendingDM = Object.values(pendingInvitesStore).find(
                    inv => inv.type === 'new_chat' &&
                           inv.fromUserId === fromUserId &&
                           inv.toUserId === toUserId
                );
                if (existingPendingDM) {
                    const recipientDetails = await fetchUserDetails([toUserId]);
                    const recipientName = recipientDetails[0]?.username || `User ${toUserId}`;
                    return callback?.({ success: false, error: `An invite to ${recipientName} is already pending.` });
                }

                console.log(`[Chat Socket ${socket.id}] User ${fromUserId} sending private invite to ${toUserId}`);

                try {
                    const sqlCheckPrivate = `
                        SELECT cm1.chat_id FROM chat_members cm1
                        JOIN chat_members cm2 ON cm1.chat_id = cm2.chat_id AND cm1.user_id != cm2.user_id
                        JOIN chat_sessions cs ON cm1.chat_id = cs.id WHERE cs.type = 'private'
                        AND ((cm1.user_id = ? AND cm2.user_id = ?) OR (cm1.user_id = ? AND cm2.user_id = ?))
                        AND (SELECT COUNT(*) FROM chat_members cm_count WHERE cm_count.chat_id = cs.id) = 2
                        LIMIT 1;`;
                    const [existingChats] = await db.query(sqlCheckPrivate, [fromUserId, toUserId, toUserId, fromUserId]);
                    if (existingChats.length > 0) {
                        const existingChatId = existingChats[0].chat_id;
                        console.log(`Existing private chat found (ID: ${existingChatId}). Informing sender.`);
                        const memberDetails = await fetchUserDetails([fromUserId, toUserId]);
                        socket.emit('openExistingChat', { chatId: existingChatId, memberIds: [fromUserId, toUserId], chatType: 'private', memberDetails }); // To self
                        return callback?.({ success: true, message: 'Chat already exists.', chatId: existingChatId });
                    }
                } catch (err) {
                    console.error("[sendChatInvite] Error checking existing chat:", err);
                    return callback?.({ success: false, error: 'Database error checking chat.' });
                }

                const recipientSocketId = onlineUsers.get(toUserId); 
                let recipientNameForMsg = `User ${toUserId}`;
                const recipientDetailsForMsg = await fetchUserDetails([toUserId]);
                if (recipientDetailsForMsg.length > 0 && recipientDetailsForMsg[0].username) {
                    recipientNameForMsg = recipientDetailsForMsg[0].username;
                }

                if (!recipientSocketId) {
                    console.log(`Recipient ${toUserId} is not online (in CHAT) for private invite.`);
                    return callback?.({ success: false, error: `${recipientNameForMsg} is not currently in chat. Invite not sent.` });
                }

                const inviteId = `invite_${Date.now()}_${fromUserId}_${toUserId}`;
                const inviteData = {
                    type: 'new_chat',
                    inviteId: inviteId,
                    fromUserId: fromUserId,
                    toUserId: toUserId,
                    memberIds: [fromUserId, toUserId],
                    timestamp: new Date(),
                    senderUsername: user.username,
                    senderProfilePhotoUrl: user.profilePhotoUrl
                };
                pendingInvitesStore[inviteId] = inviteData;

                console.log(`Emitting 'chatInvite' (ID: ${inviteId}) to CHAT socket ${recipientSocketId}`);
                chatNamespace.to(recipientSocketId).emit('chatInvite', inviteData); 

                callback?.({ success: true, inviteId: inviteData.inviteId });
            });

            socket.on('sendGroupChatInvite', async (data, callback) => {
                const fromUserId = userId;
                const initiatorDetailsArray = await fetchUserDetails([fromUserId]);
                const initiatorInfo = initiatorDetailsArray[0] || { id: fromUserId, username: user.username, profilePhotoUrl: user.profilePhotoUrl };

                const allIntendedMemberIds = Array.from(new Set(
                    [fromUserId, ...(data.memberIds || [])]
                    .map(id => parseInt(id, 10))
                    .filter(id => !isNaN(id))
                )).sort((a, b) => a - b);

                if (allIntendedMemberIds.length === 0) {
                    return callback?.({ success: false, error: 'No valid members for group chat.' });
                }

                if (allIntendedMemberIds.length > 0) {
                    const placeholders = allIntendedMemberIds.map(() => '?').join(',');
                    const sqlCheckExactGroup = `
                        SELECT cs.id FROM chat_sessions cs
                        WHERE cs.type = 'group'
                        AND (SELECT COUNT(DISTINCT cm_count.user_id) FROM chat_members cm_count WHERE cm_count.chat_id = cs.id) = ?
                        AND cs.id IN (
                            SELECT cm.chat_id FROM chat_members cm WHERE cm.user_id IN (${placeholders})
                            GROUP BY cm.chat_id HAVING COUNT(DISTINCT cm.user_id) = ?
                        );`;
                    const queryParamsCheckExact = [allIntendedMemberIds.length, ...allIntendedMemberIds, allIntendedMemberIds.length];
                    const [existingExactGroups] = await db.query(sqlCheckExactGroup, queryParamsCheckExact);

                    if (existingExactGroups.length > 0) {
                        const existingGroupId = existingExactGroups[0].id;
                        if (allIntendedMemberIds.length === 1 && allIntendedMemberIds[0] === fromUserId) {
                             const memberDetails = await fetchUserDetails(allIntendedMemberIds);
                             return callback?.({ success: true, message: 'Self-group chat already exists.', chatSessionId: existingGroupId, chatSessionData: { id: existingGroupId, type: 'group', members: allIntendedMemberIds, memberDetails } });
                        }
                        return callback?.({ success: false, error: 'A group with these exact members already exists.' });
                    }
                }

                if (allIntendedMemberIds.length === 1 && allIntendedMemberIds[0] === fromUserId) {
                    console.log(`[Chat Socket ${socket.id}] User ${fromUserId} creating new self-group.`);
                    try {
                        const [sessionResult] = await db.query('INSERT INTO chat_sessions (type) VALUES (?)', ['group']);
                        const chatSessionId = sessionResult.insertId;
                        await db.query('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', [chatSessionId, fromUserId]);
                        const memberDetails = await fetchUserDetails([fromUserId]);
                        const chatSessionData = { id: chatSessionId, type: 'group', members: [fromUserId], memberDetails };

                        return callback?.({ success: true, chatSessionId, chatSessionData });
                    } catch (err) {
                        console.error("[sendGroupChatInvite] Error creating self-group:", err);
                        return callback?.({ success: false, error: 'Failed to create self-group chat session.' });
                    }
                }

                console.log(`[Chat Socket ${socket.id}] User ${fromUserId} initiating new group with potential members: ${allIntendedMemberIds.join(', ')}`);
                try {
                    const [sessionResult] = await db.query('INSERT INTO chat_sessions (type) VALUES (?)', ['group']);
                    const chatSessionId = sessionResult.insertId;
                    await db.query('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', [chatSessionId, fromUserId]);

                    const invitees = allIntendedMemberIds.filter(id => id !== fromUserId);
                    for (const inviteeId of invitees) {
                        const inviteId = `grp_create_${Date.now()}_${inviteeId}_${chatSessionId}`;
                        const invitePayload = {
                            type: 'group_creation_invite',
                            inviteId,
                            chatId: chatSessionId,
                            inviterId: fromUserId,
                            invitedUserId: inviteeId,
                            allInitiallyInvitedUserIds: [...allIntendedMemberIds],
                            timestamp: new Date(),
                            inviterUsername: initiatorInfo.username,
                            inviterProfilePhotoUrl: initiatorInfo.profilePhotoUrl
                        };
                        pendingInvitesStore[inviteId] = invitePayload;

                        const recipientSocketId = onlineUsers.get(inviteeId); 
                        if (recipientSocketId) {
                            chatNamespace.to(recipientSocketId).emit('groupCreationInvite', invitePayload); 
                        } else {
                            console.log(`User ${inviteeId} is offline (from CHAT), group creation invite ${inviteId} stored.`);
                        }
                    }

                    const initiatorOnlyDetails = await fetchUserDetails([fromUserId]);
                    const chatSessionDataForInitiator = {
                        id: chatSessionId,
                        type: 'group',
                        members: [fromUserId],
                        memberDetails: initiatorOnlyDetails
                    };
                    return callback?.({ success: true, chatSessionId, chatSessionData: chatSessionDataForInitiator });

                } catch (err) {
                    console.error("[sendGroupChatInvite] Error creating group and sending invites:", err);
                    return callback?.({ success: false, error: 'Failed to initiate group chat.' });
                }
            });

            socket.on('sendInvitesToExistingChat', async ({ chatId, invitedUserIds }, callback) => {
                if (!chatId || !Array.isArray(invitedUserIds) || invitedUserIds.length === 0) {
                    return callback?.({ success: false, error: 'Invalid data: chatId and invitedUserIds array are required.' });
                }
                const inviterId = userId;
                console.log(`[Chat Socket ${socket.id}] User ${inviterId} inviting users ${invitedUserIds.join(', ')} to existing chat ${chatId}`);

                try {
                    const [chatRows] = await db.query('SELECT type FROM chat_sessions WHERE id = ?', [chatId]);
                    if (chatRows.length === 0) return callback?.({ success: false, error: 'Chat not found.' });
                    if (chatRows[0].type !== 'group') return callback?.({ success: false, error: 'Can only invite users to group chats.' });

                    const [inviterMemberRows] = await db.query('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?', [chatId, inviterId]);
                    if (inviterMemberRows.length === 0) return callback?.({ success: false, error: 'You are not a member of this chat.' });

                    const [currentMemberObjects] = await db.query('SELECT user_id FROM chat_members WHERE chat_id = ?', [chatId]);
                    const currentMemberIds = currentMemberObjects.map(m => m.user_id);

                    const inviterDetailsArray = await fetchUserDetails([inviterId]);
                    const inviterInfo = inviterDetailsArray[0] || { id: inviterId, username: `User ${inviterId}`, profilePhotoUrl: null };

                    const results = [];
                    const usersEligibleForCollectiveCheck = [];
                    const validInvitedUserIds = [];

                    for (const invitedId of invitedUserIds) {
                        const invitedUserIdNum = parseInt(invitedId, 10);
                        if (isNaN(invitedUserIdNum)) {
                            results.push({ userId: invitedId, success: false, error: 'Invalid user ID.' });
                            continue;
                        }
                        if (invitedUserIdNum === inviterId) {
                            results.push({ userId: invitedUserIdNum, success: false, error: 'Cannot invite inviter.'});
                            continue;
                        }
                        if (currentMemberIds.includes(invitedUserIdNum)) {
                            results.push({ userId: invitedUserIdNum, success: false, error: 'User is already in this chat.' });
                            continue;
                        }
                        const existingPendingInviteToThisChat = Object.values(pendingInvitesStore).find(
                            inv => (inv.type === 'existing_chat' || inv.type === 'group_creation_invite') &&
                                   inv.chatId === chatId &&
                                   inv.invitedUserId === invitedUserIdNum
                        );
                        if (existingPendingInviteToThisChat) {
                            results.push({ userId: invitedUserIdNum, success: false, error: 'User already has a pending invite to this chat.' });
                            continue;
                        }
                        validInvitedUserIds.push(invitedUserIdNum);
                        usersEligibleForCollectiveCheck.push(invitedUserIdNum);
                    }

                    const uniqueUsersEligibleForCollective = Array.from(new Set(usersEligibleForCollectiveCheck));
                    let finalValidInvitedUserIds = [...validInvitedUserIds];

                    if (uniqueUsersEligibleForCollective.length > 0) {
                        const finalProspectiveMembers = Array.from(new Set([...currentMemberIds, ...uniqueUsersEligibleForCollective])).sort((a, b) => a - b);
                        const placeholders = finalProspectiveMembers.map(() => '?').join(',');
                        const sqlCheckCollectiveDuplicate = `
                            SELECT cs.id FROM chat_sessions cs
                            WHERE cs.type = 'group' AND cs.id != ?
                            AND (SELECT COUNT(DISTINCT cm_count.user_id) FROM chat_members cm_count WHERE cm_count.chat_id = cs.id) = ?
                            AND cs.id IN (
                                SELECT cm.chat_id FROM chat_members cm WHERE cm.user_id IN (${placeholders})
                                GROUP BY cm.chat_id HAVING COUNT(DISTINCT cm.user_id) = ?
                            );`;
                        const queryParamsCollective = [chatId, finalProspectiveMembers.length, ...finalProspectiveMembers, finalProspectiveMembers.length];
                        const [existingCollectiveGroups] = await db.query(sqlCheckCollectiveDuplicate, queryParamsCollective);

                        if (existingCollectiveGroups.length > 0) {
                            const errorMsg = 'Adding these users would create a duplicate of an existing group.';
                            uniqueUsersEligibleForCollective.forEach(uid => {
                                if(!results.find(r => r.userId === uid)) {
                                     results.push({ userId: uid, success: false, error: errorMsg });
                                }
                            });
                            finalValidInvitedUserIds = validInvitedUserIds.filter(uid => !uniqueUsersEligibleForCollective.includes(uid));
                        }
                    }

                    let atLeastOneSuccess = false;
                    let globalMessage = null; 

                    for (const invitedUserIdNum of Array.from(new Set(finalValidInvitedUserIds))) { 
                        const inviteId = `exchat_${Date.now()}_${invitedUserIdNum}_${chatId}`;
                        const invitePayload = {
                            type: 'existing_chat',
                            inviteId,
                            chatId,
                            inviterId: inviterId,
                            invitedUserId: invitedUserIdNum,
                            existingMemberIds: [...currentMemberIds],
                            timestamp: new Date(),
                            inviterUsername: inviterInfo.username,
                            inviterProfilePhotoUrl: inviterInfo.profilePhotoUrl
                        };
                        pendingInvitesStore[inviteId] = invitePayload;

                        const recipientSocketId = onlineUsers.get(invitedUserIdNum); 
                        if (recipientSocketId) {
                            chatNamespace.to(recipientSocketId).emit('receivedInviteToExistingChat', pendingInvitesStore[inviteId]); // Use chatNamespace
                            results.push({ userId: invitedUserIdNum, success: true, inviteId });
                            atLeastOneSuccess = true;
                        } else {
                            delete pendingInvitesStore[inviteId];
                            let invitedUserName = `User ${invitedUserIdNum}`;
                            const invitedUserDetails = await fetchUserDetails([invitedUserIdNum]);
                            if (invitedUserDetails.length > 0 && invitedUserDetails[0].username) {
                                invitedUserName = invitedUserDetails[0].username;
                            }
                            const offlineError = `${invitedUserName} is not currently in chat.`;
                            results.push({ userId: invitedUserIdNum, success: false, error: offlineError });
                            if (finalValidInvitedUserIds.length === 1 && results.length === finalValidInvitedUserIds.length) globalMessage = offlineError;
                        }
                    }

                    callback?.({
                        success: atLeastOneSuccess,
                        message: globalMessage || (atLeastOneSuccess ? "Invites processed." : "No new invites could be sent (check errors for details)."),
                        results
                    });

                } catch (err) {
                    console.error(`[sendInvitesToExistingChat] Error for chat ${chatId} by user ${inviterId}:`, err);
                    callback?.({ success: false, error: 'Server error processing invites.' });
                }
            });

            socket.on('respondToInvite', async (data, callback) => {
                if (!data || !data.inviteId || typeof data.accept !== 'boolean') {
                    return callback?.({ success: false, error: 'Invalid invite response data.' });
                }
                const respondingUserId = userId;
                const { inviteId, accept } = data;
                const invite = pendingInvitesStore[inviteId];

                if (!invite) {
                    return callback?.({ success: false, error: 'Invite not found or expired.' });
                }
                if ((invite.type === 'new_chat' && invite.toUserId !== respondingUserId) ||
                    (invite.type === 'existing_chat' && invite.invitedUserId !== respondingUserId) ||
                    (invite.type === 'group_creation_invite' && invite.invitedUserId !== respondingUserId)
                    ) {
                    console.warn(`User ${respondingUserId} attempted to respond to invite ${inviteId} not intended for them.`);
                    return callback?.({ success: false, error: 'Not authorized to respond to this invite.' });
                }
                console.log(`[Chat Socket ${socket.id}] User ${respondingUserId} responded to invite ${inviteId} (type: ${invite.type}) with accept=${accept}`);

                const respondingUserDetailsArray = await fetchUserDetails([respondingUserId]);
                const respondingUsername = respondingUserDetailsArray[0]?.username || `User ${respondingUserId}`;

                if (invite.type === 'existing_chat') {
                    const { chatId, invitedUserId, inviterId } = invite;
                    if (accept) {
                        try {
                            const [alreadyMemberRows] = await db.query('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?', [chatId, invitedUserId]);
                            if (alreadyMemberRows.length > 0) {
                                delete pendingInvitesStore[inviteId];
                                const [currentMembersRows] = await db.query('SELECT user_id FROM chat_members WHERE chat_id = ?', [chatId]);
                                const memberIdsForCb = currentMembersRows.map(r => r.user_id);
                                const memberDetails = await fetchUserDetails(memberIdsForCb);
                                const [chatSessRows] = await db.query('SELECT id, type FROM chat_sessions WHERE id = ?', [chatId]);
                                return callback?.({ success: true, message: "Already a member.", chatSession: { ...chatSessRows[0], members: memberIdsForCb, memberDetails } });
                            }

                            await db.query('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', [chatId, invitedUserId]);
                            delete pendingInvitesStore[inviteId];

                            const systemMessageText = `${respondingUsername} has joined the chat.`;
                            const [sysMsgResult] = await db.query(
                                'INSERT INTO chat_messages (chat_id, message, type, sender_id) VALUES (?, ?, \'system\', NULL)',
                                [chatId, systemMessageText]
                            );
                            const systemMessageId = sysMsgResult.insertId;
                            const [systemMessageFullRows] = await db.query(
                                'SELECT id, chat_id, sender_id, message, timestamp, type FROM chat_messages WHERE id = ?', [systemMessageId]
                            );
                            const systemMessageForClient = { ...systemMessageFullRows[0], senderUsername: null, senderProfilePhotoUrl: null };

                            const [updatedMemberObjectsDB] = await db.query('SELECT user_id FROM chat_members WHERE chat_id = ?', [chatId]);
                            const updatedMemberIds = updatedMemberObjectsDB.map(m => m.user_id);
                            const allMemberDetails = await fetchUserDetails(updatedMemberIds);
                            const [chatSessionRows] = await db.query('SELECT id, type FROM chat_sessions WHERE id = ?', [chatId]);
                            const chatSessionDataForUpdate = { ...chatSessionRows[0], members: updatedMemberIds, memberDetails: allMemberDetails };

                            updatedMemberIds.forEach(member_uid => {
                                const memberSocketId = onlineUsers.get(member_uid);
                                if (memberSocketId) {
                                    chatNamespace.to(memberSocketId).emit('chatSessionUpdated', chatSessionDataForUpdate);
                                    chatNamespace.to(memberSocketId).emit('chatMessage', { chatId, message: systemMessageForClient });
                                }
                            });
                            const inviterSocketId = onlineUsers.get(inviterId);
                             if (inviterSocketId) {
                                 chatNamespace.to(inviterSocketId).emit('inviteAccepted', {
                                     inviteId: null,
                                     chatId: chatId,
                                     acceptedByUserId: invitedUserId,
                                     acceptedByUsername: respondingUsername,
                                 });
                             }
                            callback?.({ success: true, chatSession: chatSessionDataForUpdate });
                        } catch (err) {
                            console.error(`[respondToInvite existing_chat ACCEPT] Error for invite ${inviteId}:`, err);
                            callback?.({ success: false, error: 'Server error processing invite acceptance.' });
                        }
                    } else {
                        delete pendingInvitesStore[inviteId];
                        const inviterSocketId = onlineUsers.get(inviterId);
                        if (inviterSocketId) {
                            chatNamespace.to(inviterSocketId).emit('existingChatInviteDeclined', {
                                inviteId, chatId: invite.chatId, declinedByUserId: invitedUserId, declinedByUsername: respondingUsername,
                                message: `${respondingUsername} declined your invite to join the chat.`
                            });
                        }
                        callback?.({ success: true, message: "Invite declined." });
                    }
                } else if (invite.type === 'group_creation_invite') {
                    const { chatId, inviterId, invitedUserId } = invite;
                     if (accept) {
                        try {
                            const [alreadyMemberRows] = await db.query('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?', [chatId, invitedUserId]);
                            if (alreadyMemberRows.length > 0) {
                                delete pendingInvitesStore[inviteId];
                            } else {
                                await db.query('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', [chatId, invitedUserId]);
                            }
                            delete pendingInvitesStore[inviteId];

                            const systemMessageText = `${respondingUsername} has joined the group.`;
                            const [sysMsgResult] = await db.query('INSERT INTO chat_messages (chat_id, message, type, sender_id) VALUES (?, ?, \'system\', NULL)',[chatId, systemMessageText]);
                            const systemMessageId = sysMsgResult.insertId;
                            const [systemMessageFullRows] = await db.query('SELECT id, chat_id, sender_id, message, timestamp, type FROM chat_messages WHERE id = ?', [systemMessageId]);
                            const systemMessageForClient = { ...systemMessageFullRows[0], senderUsername: null, senderProfilePhotoUrl: null };

                            const [updatedMemberObjectsDB] = await db.query('SELECT user_id FROM chat_members WHERE chat_id = ?', [chatId]);
                            const updatedMemberIds = updatedMemberObjectsDB.map(m => m.user_id);
                            const allMemberDetails = await fetchUserDetails(updatedMemberIds);
                            const [chatSessionRows] = await db.query('SELECT id, type FROM chat_sessions WHERE id = ?', [chatId]);
                            const chatSessionDataForUpdate = { ...chatSessionRows[0], members: updatedMemberIds, memberDetails: allMemberDetails };

                            updatedMemberIds.forEach(member_uid => {
                                const memberSocketId = onlineUsers.get(member_uid);
                                if (memberSocketId) {
                                    if (member_uid === invitedUserId) {
                                        chatNamespace.to(memberSocketId).emit('newChatSession', chatSessionDataForUpdate);
                                    } else {
                                        chatNamespace.to(memberSocketId).emit('chatSessionUpdated', chatSessionDataForUpdate);
                                    }
                                    chatNamespace.to(memberSocketId).emit('chatMessage', { chatId, message: systemMessageForClient });
                                }
                            });
                            const inviterSocketId = onlineUsers.get(inviterId);
                            if (inviterSocketId && inviterId !== invitedUserId) {
                                chatNamespace.to(inviterSocketId).emit('inviteAccepted', { 
                                    inviteId: null,
                                    chatId: chatId,
                                    acceptedByUserId: invitedUserId,
                                    acceptedByUsername: respondingUsername
                                });
                            }
                            callback?.({ success: true, chatSession: chatSessionDataForUpdate });

                        } catch (err) {
                             console.error(`[respondToInvite group_creation_invite ACCEPT] Error for invite ${inviteId}:`, err);
                             callback?.({ success: false, error: 'Server error joining group.' });
                        }
                    } else {
                        delete pendingInvitesStore[inviteId];
                        const inviterSocketId = onlineUsers.get(inviterId); 
                        if (inviterSocketId) {
                            chatNamespace.to(inviterSocketId).emit('groupCreationInviteDeclined', { 
                                inviteId,
                                chatId: invite.chatId,
                                declinedByUserId: invitedUserId,
                                declinedByUsername: respondingUsername,
                                message: `${respondingUsername} declined to join the new group.`
                            });
                        }
                        callback?.({ success: true, message: "Group invite declined." });
                    }
                } else if (invite.type === 'new_chat') {
                    delete pendingInvitesStore[inviteId]; 
                    if (accept) {
                        const { memberIds, fromUserId } = invite;
                        const chatType = 'private';
                        try {
                            let chatSessionId;
                            let isNewSession = false;
                            const sqlCheckPrivate = `
                                SELECT cm1.chat_id FROM chat_members cm1
                                JOIN chat_members cm2 ON cm1.chat_id = cm2.chat_id AND cm1.user_id != cm2.user_id
                                JOIN chat_sessions cs ON cm1.chat_id = cs.id WHERE cs.type = 'private'
                                AND ((cm1.user_id = ? AND cm2.user_id = ?) OR (cm1.user_id = ? AND cm2.user_id = ?))
                                AND (SELECT COUNT(*) FROM chat_members cm_count WHERE cm_count.chat_id = cs.id) = 2 LIMIT 1;`;
                            const [existingChats] = await db.query(sqlCheckPrivate, [memberIds[0], memberIds[1], memberIds[1], memberIds[0]]);
                            if (existingChats.length > 0) chatSessionId = existingChats[0].chat_id;

                            if (!chatSessionId) {
                                const sqlInsertSession = 'INSERT INTO chat_sessions (type) VALUES (?)';
                                const [sessionResult] = await db.query(sqlInsertSession, [chatType]);
                                chatSessionId = sessionResult.insertId;
                                isNewSession = true;
                                const memberValues = memberIds.map(id => [chatSessionId, id]);
                                const sqlInsertMembers = 'INSERT INTO chat_members (chat_id, user_id) VALUES ?';
                                await db.query(sqlInsertMembers, [memberValues]);
                                console.log(`Created new ${chatType} chat ${chatSessionId} for members ${memberIds.join(',')}`);
                            } else {
                                console.log(`User ${respondingUserId} joined existing private chat ${chatSessionId}`);
                            }
                            const memberDetails = await fetchUserDetails(memberIds);
                            const chatSessionData = { id: chatSessionId, type: chatType, members: memberIds, memberDetails };

                            const inviterSocketId = onlineUsers.get(fromUserId); 
                            if (inviterSocketId) {
                                chatNamespace.to(inviterSocketId).emit('inviteAccepted', {
                                    inviteId,
                                    chatSession: chatSessionData,
                                    acceptedByUserId: respondingUserId,
                                    acceptedByUsername: respondingUsername
                                });
                                if (isNewSession) chatNamespace.to(inviterSocketId).emit('newChatSession', chatSessionData);
                            }
                            callback?.({ success: true, chatSession: chatSessionData });
                            socket.emit('newChatSession', chatSessionData); 
                        } catch (err) {
                            console.error("[respondToInvite new_chat ACCEPT] Error creating/joining chat:", err);
                            callback?.({ success: false, error: 'Failed to process DM invite response.' });
                        }
                    } else {
                        const inviterSocketId = onlineUsers.get(invite.fromUserId);
                        if (inviterSocketId) {
                            chatNamespace.to(inviterSocketId).emit('inviteDeclined', {
                                inviteId,
                                fromUserId: respondingUserId,
                                fromUsername: respondingUsername
                            });
                        }
                        callback?.({ success: true, message: "Invite declined." });
                    }
                } else {
                    console.warn(`[respondToInvite] Unrecognized invite type in store for inviteId: ${inviteId}`);
                    delete pendingInvitesStore[inviteId];
                    return callback?.({ success: false, error: 'Internal error: Unrecognized invite type.' });
                }
            });

            socket.on('sendMessage', async (data, callback) => {
                if (!data || !data.chatId || typeof data.message !== 'string' || data.message.trim() === '') {
                    return callback?.({ success: false, error: 'Invalid message data.' });
                }
                const senderId = userId;
                const chatId = parseInt(data.chatId, 10);
                const messageContent = data.message.trim();

                if (isNaN(chatId)) return callback?.({ success: false, error: 'Invalid chat ID.' });

                try {
                    const [memberRows] = await db.query('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?', [chatId, senderId]);
                    if (memberRows.length === 0) return callback?.({ success: false, error: 'Not a member of this chat.' });

                    const [insertResult] = await db.query(
                        'INSERT INTO chat_messages (chat_id, sender_id, message, type) VALUES (?, ?, ?, ?)',
                        [chatId, senderId, messageContent, 'user']
                    );
                    const msgId = insertResult.insertId;

                    const [newMsgRows] = await db.query(
                        `SELECT cm.id, cm.chat_id, cm.sender_id, cm.message, cm.timestamp, cm.type, u.username as senderUsername, u.profile_photo_url
                         FROM chat_messages cm
                         JOIN users u ON cm.sender_id = u.user_id
                         WHERE cm.id = ?`, [msgId]
                    );
                    if (newMsgRows.length === 0) throw new Error('Failed to fetch message after insert.');
                    const messageToSend = {
                        ...newMsgRows[0],
                        senderProfilePhotoUrl: newMsgRows[0].profile_photo_url
                    };

                    const [members] = await db.query('SELECT user_id FROM chat_members WHERE chat_id = ?', [chatId]);
                    members.forEach(member => {
                        const memberSocketId = onlineUsers.get(member.user_id); 
                        if (memberSocketId) {
                            chatNamespace.to(memberSocketId).emit('chatMessage', { chatId: chatId, message: messageToSend });
                        }
                    });
                    callback?.({ success: true, messageId: msgId, persistedMessage: messageToSend });
                } catch (err) {
                    console.error(`[sendMessage] Error processing message for chat ${chatId} by user ${senderId}:`, err);
                    callback?.({ success: false, error: 'Failed to send message.' });
                }
            });

            socket.on('disconnect', (reason) => {
                console.log(`[Chat Socket ${socket.id}] Disconnected from /chat: User ${user?.username} (ID: ${userId}). Reason: ${reason}`);
                if (onlineUsers.get(userId) === socket.id) { 
                    onlineUsers.delete(userId);
                    console.log(`User ${userId} (username: ${user?.username}) went offline from CHAT feature. Total CHAT online: ${onlineUsers.size}`);
                } else {
                    console.log(`Socket ${socket.id} for user ${userId} disconnected from /chat, but was not the primary tracked CHAT socket. Current CHAT socket for user: ${onlineUsers.get(userId)}`);
                }
            });
        } else {
            console.log(`[Chat Socket ${socket.id}] Connected to /chat: Unauthenticated user. Disconnecting from /chat.`);
            socket.disconnect(true);
            socket.on('disconnect', (reason) => {
                console.log(`[Chat Socket ${socket.id}] Disconnected (unauthenticated) from /chat. Reason: ${reason}`);
            });
        }
    });

    console.log("Chat Socket Service initialized and attached to /chat namespace.");
    return chatNamespace;
}

export { onlineUsers };