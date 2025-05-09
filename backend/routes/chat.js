const express = require('express');
const router = express.Router();
const db = require('../db'); 
const { isAuthenticated } = require('./middleware/authMiddleware'); 

// friends
router.get('/friends', isAuthenticated, async (req, res) => {
  const userId = req.session.user.userId;
  try {
    const sql = `
      SELECT u.user_id, u.username, u.first_name, u.last_name, u.profile_photo_url
      FROM users u
      JOIN friendships f ON (u.user_id = f.user1_id OR u.user_id = f.user2_id)
      WHERE (f.user1_id = ? OR f.user2_id = ?) AND u.user_id != ? AND f.status = 'accepted'`;
    const [friends] = await db.query(sql, [userId, userId, userId]);
    res.json({ friends: friends.map(f => ({...f, isOnline: false })) });
  } catch (err) {
    console.error(`Error fetching friends for user ${userId}:`, err);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// POST /api/chat/invite - chat invites
router.post('/invite', isAuthenticated, async (req, res) => {
    console.warn("HTTP POST /api/chat/invite called. Real-time delivery relies on client emitting socket event.");
    res.status(202).json({ message: "Request received. Use WebSocket 'sendChatInvite' or 'sendGroupChatInvite' for real-time functionality." });
});

// POST /api/chat/invite/respond - respond to invite
router.post('/invite/respond', isAuthenticated, async (req, res) => {
    console.warn("HTTP POST /api/chat/invite/respond called. Use WebSocket 'respondToInvite' event for real-time functionality.");
    res.status(202).json({ message: "Request received. Use WebSocket 'respondToInvite' for real-time functionality." });
});

// POST /api/chat/:chatId/message - send a message 
router.post('/:chatId/message', isAuthenticated, async (req, res) => {
    const chatId = parseInt(req.params.chatId, 10);
    if (isNaN(chatId)) return res.status(400).json({ error: 'Invalid chatId format.' });
    const senderId = req.session.user.userId;
    const { message } = req.body;
    if (message === undefined || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({ error: 'Non-empty message string required' });
    }
    console.warn(`HTTP POST /api/chat/${chatId}/message called by user ${senderId}. Real-time broadcast should use socket 'sendMessage' event.`);
    try {
        const checkMemberSql = 'SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?';
        const [memberRows] = await db.query(checkMemberSql, [chatId, senderId]);
        if (memberRows.length === 0) {
            return res.status(403).json({ error: 'You are not a member of this chat session.' });
        }
        const insertMsgSql = 'INSERT INTO chat_messages (chat_id, sender_id, message, type) VALUES (?, ?, ?, ?)';
        const [insertResult] = await db.query(insertMsgSql, [chatId, senderId, message, 'user']);
        const msgId = insertResult.insertId;
        const selectMsgSql = `
          SELECT cm.id, cm.chat_id, cm.sender_id, cm.message, cm.timestamp, cm.type,
                 u.username as senderUsername, u.profile_photo_url as senderProfilePhotoUrl
          FROM chat_messages cm JOIN users u ON cm.sender_id = u.user_id
          WHERE cm.id = ?`;
        const [newMsgRows] = await db.query(selectMsgSql, [msgId]);
        if (newMsgRows.length === 0) {
            return res.status(500).json({ error: 'Failed to retrieve the message after sending.' });
        }
        res.status(201).json({ message: newMsgRows[0] });
    } catch (err) {
        console.error(`Database error processing message for chat ${chatId} via HTTP:`, err);
        res.status(500).json({ error: 'Failed to send message' });
    }
});


// GET /api/chat/sessions 0-- fetch chat data
router.get('/sessions', isAuthenticated, async (req, res) => {
  const userId = req.session.user.userId;
  try {
      const fetchUserDetailsFunc = req.app.get('chatFetchUserDetails'); 
      if (!fetchUserDetailsFunc) {
        console.error("CRITICAL: chatFetchUserDetails not available on req.app in GET /sessions");
        return res.status(500).json({ error: 'Server configuration error (fetch user details).' });
      }

      const sql = `
          SELECT cs.id, cs.type
          FROM chat_sessions cs
          JOIN chat_members cm ON cs.id = cm.chat_id
          WHERE cm.user_id = ?`;
      const [sessions] = await db.query(sql, [userId]);

      const activeChatsData = {};
      for (const session of sessions) {
          const [memberRows] = await db.query('SELECT user_id FROM chat_members WHERE chat_id = ?', [session.id]);
          const memberIds = memberRows.map(m => m.user_id);
          const memberDetails = await fetchUserDetailsFunc(memberIds);

          activeChatsData[session.id] = {
              id: session.id,
              type: session.type,
              members: memberIds,
              memberDetails: memberDetails,
          };
      }
      res.json({ activeChats: activeChatsData });
  } catch (err) {
      console.error(`Error fetching chat sessions for user ${userId}:`, err);
      res.status(500).json({ error: 'Failed to fetch chat sessions' });
  }
});

// GET /api/chat/:chatId/messages
router.get('/:chatId/messages', isAuthenticated, async (req, res) => {
    const chatId = parseInt(req.params.chatId, 10);
    if (isNaN(chatId)) return res.status(400).json({ error: 'Invalid chatId format.' });
    const userId = req.session.user.userId;
    try {
        const checkMemberSql = 'SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?';
        const [memberRows] = await db.query(checkMemberSql, [chatId, userId]);
        if (memberRows.length === 0) {
            return res.status(403).json({ error: 'You are not authorized to view messages for this chat.' });
        }
        const sql = `
          SELECT cm.id, cm.chat_id, cm.sender_id, cm.message, cm.timestamp, cm.type,
                 u.username as senderUsername, u.profile_photo_url as senderProfilePhotoUrl
          FROM chat_messages cm
          LEFT JOIN users u ON cm.sender_id = u.user_id -- LEFT JOIN for system messages or if sender deleted
          WHERE cm.chat_id = ? ORDER BY cm.timestamp ASC`;
        const [messages] = await db.query(sql, [chatId]);
        res.json({ messages });
    } catch (err) {
        console.error(`Error fetching messages for chat ${chatId}:`, err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// POST /api/chat/:chatId/leave  -- leave chat
router.post('/:chatId/leave', isAuthenticated, async (req, res) => {
    const chatId = parseInt(req.params.chatId, 10);
    if (isNaN(chatId)) return res.status(400).json({ error: 'Invalid chatId format.' });

    const leavingUserId = req.session.user.userId;
    const leavingUsername = req.session.user.username || 'User'; 

    const chatNamespace = req.app.get('chatIoNamespace');
    const chatOnlineUsersMap = req.app.get('chatSpecificOnlineUsers'); 
    const fetchUserDetailsFunc = req.app.get('chatFetchUserDetails');

    if (!chatNamespace || !chatOnlineUsersMap || !fetchUserDetailsFunc) {
        console.error("CRITICAL: Chat namespace, chat online users map, or fetchUserDetailsFunc not available on req.app for leave chat action.");
        return res.status(500).json({ error: 'Chat server components not properly configured for real-time updates.' });
    }

    try {
        const [memberCheck] = await db.query('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?', [chatId, leavingUserId]);
        if (memberCheck.length === 0) {
            return res.status(404).json({ message: 'You are not currently a member of this chat session.' });
        }

        const [deleteResult] = await db.query('DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?', [chatId, leavingUserId]);

        if (deleteResult.affectedRows > 0) {
            console.log(`[Leave Chat] User ${leavingUserId} (${leavingUsername}) successfully removed from chat ${chatId} DB.`);

            const systemMessageText = `${leavingUsername} has left the chat.`;
            const [sysMsgResult] = await db.query(
                'INSERT INTO chat_messages (chat_id, message, type, sender_id) VALUES (?, ?, \'system\', NULL)',
                [chatId, systemMessageText]
            );
            const systemMessageId = sysMsgResult.insertId;

            const [systemMessageFullRows] = await db.query(
                'SELECT id, chat_id, sender_id, message, timestamp, type FROM chat_messages WHERE id = ?',
                [systemMessageId]
            );

            if (systemMessageFullRows.length === 0) {
                 console.error(`[Leave Chat] Could not fetch system message ${systemMessageId} after insert for chat ${chatId}.`);
            }
            const systemMessageForClient = systemMessageFullRows.length > 0 ? {
                ...systemMessageFullRows[0],
                senderUsername: null,
                senderProfilePhotoUrl: null
            } : null;

            const [remainingMemberRows] = await db.query('SELECT user_id FROM chat_members WHERE chat_id = ?', [chatId]);
            const remainingMemberIds = remainingMemberRows.map(m => m.user_id);

            if (remainingMemberIds.length > 0) {
                console.log(`[Leave Chat] Chat ${chatId} still has ${remainingMemberIds.length} members. Notifying...`);

                const remainingMemberDetails = await fetchUserDetailsFunc(remainingMemberIds);
                const [chatSessionInfoRows] = await db.query('SELECT id, type FROM chat_sessions WHERE id = ?', [chatId]);

                if (chatSessionInfoRows.length > 0) {
                    const chatSessionUpdateData = {
                        ...chatSessionInfoRows[0],
                        members: remainingMemberIds,
                        memberDetails: remainingMemberDetails
                    };
                    let notifiedCount = 0;
                    remainingMemberIds.forEach(member_uid => {
                        const memberSocketId = chatOnlineUsersMap.get(member_uid); 
                        if (memberSocketId) {
                            if (systemMessageForClient) {
                                chatNamespace.to(memberSocketId).emit('chatMessage', { chatId, message: systemMessageForClient });
                            }
                            chatNamespace.to(memberSocketId).emit('chatSessionUpdated', chatSessionUpdateData);
                            notifiedCount++;
                        }
                    });
                     console.log(`[Leave Chat] Notified ${notifiedCount}/${remainingMemberIds.length} remaining members in chat ${chatId}.`);
                } else {
                     console.error(`[Leave Chat] Could not find chat session info for chat ${chatId} after member left.`);
                }
            } else {
                console.log(`[Leave Chat] Chat ${chatId} is now empty. Deleting session and associated messages.`);
                await db.query('DELETE FROM chat_messages WHERE chat_id = ?', [chatId]);
                await db.query('DELETE FROM chat_sessions WHERE id = ?', [chatId]);
                 console.log(`[Leave Chat] Deleted chat session ${chatId} and messages.`);
            }
            res.json({ success: true, message: 'Successfully left chat session' });
        } else {
             console.warn(`[Leave Chat] Delete query affected 0 rows for user ${leavingUserId} in chat ${chatId}. User might have already left.`);
            res.status(404).json({ message: 'Failed to remove you from chat, possibly already left.' });
        }
    } catch (err) {
        console.error(`Error during user ${leavingUserId} leaving chat ${chatId}:`, err);
        res.status(500).json({ error: 'Failed to leave chat session due to a server error' });
    }
});

module.exports = router; 