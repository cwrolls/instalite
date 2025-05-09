const express = require('express');
const router = express.Router();
const db = require('../db'); 
const { isAuthenticated } = require('./middleware/authMiddleware'); 

// helper funcs
const fetchFriendshipById = async (friendshipId) => {
    const [rows] = await db.query('SELECT * FROM friendships WHERE friendship_id = ?', [friendshipId]);
    return rows[0];
};

const checkExistingFriendship = async (user1, user2) => {
    const [rows] = await db.query(
        `SELECT * FROM friendships
         WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`,
        [user1, user2, user2, user1]
    );
    return rows[0];
};


// GET /api/friendships/status/:otherUserId
router.get('/status/:otherUserId', isAuthenticated, async (req, res) => {
    const currentUserId = req.session.user.userId;
    const otherUserId = parseInt(req.params.otherUserId, 10);

    if (isNaN(otherUserId)) {
        return res.status(400).json({ error: 'Invalid otherUserId.' });
    }
    if (currentUserId === otherUserId) {
        return res.json({ friendship: null, message: 'Cannot have friendship status with oneself.' });
    }
    try {
        const friendship = await checkExistingFriendship(currentUserId, otherUserId);
        res.json({ friendship: friendship || null });
    } catch (error) {
        console.error(`Error fetching friendship status between ${currentUserId} and ${otherUserId}:`, error);
        res.status(500).json({ error: 'Failed to fetch friendship status.' });
    }
});

// POST /api/friendships/request
router.post('/request', isAuthenticated, async (req, res) => {
    const requesterId = req.session.user.userId;
    const requesterUsername = req.session.user.username; 
    const recipientId = parseInt(req.body.recipientId, 10);

    const sendToast = req.app.get('sendGlobalToast');
    if (!sendToast) {
         console.error("sendGlobalToast function not found on req.app in POST /request");
    }

    if (!recipientId || isNaN(recipientId)) {
        return res.status(400).json({ error: 'Valid recipientId is required.' });
    }
    if (requesterId === recipientId) {
        return res.status(400).json({ error: 'Cannot send friend request to yourself.' });
    }

    try {
        const [recipientUser] = await db.query('SELECT user_id FROM users WHERE user_id = ?', [recipientId]);
        if (recipientUser.length === 0) {
             return res.status(404).json({ error: 'Recipient user not found.' });
        }

        const existing = await checkExistingFriendship(requesterId, recipientId);
        if (existing) {
            if (existing.status === 'pending') {
                 return res.status(409).json({ error: `A friend request already exists and is pending.`, friendship: existing });
            }
            return res.status(409).json({ error: `Friendship status already exists: ${existing.status}`, friendship: existing });
        }

        const user1 = Math.min(requesterId, recipientId);
        const user2 = Math.max(requesterId, recipientId);

        const sql = `INSERT INTO friendships (user1_id, user2_id, status, action_user_id, created_at) VALUES (?, ?, ?, ?, NOW())`;
        const [result] = await db.query(sql, [user1, user2, 'pending', requesterId]);
        const newFriendshipId = result.insertId;
        const newFriendship = await fetchFriendshipById(newFriendshipId);

        console.log(`User ${requesterId} (${requesterUsername}) sent friend request to ${recipientId}`);

        if (sendToast) {
            sendToast(recipientId, {
                title: "New Friend Request",
                content: `You have received a friend request from ${requesterUsername || 'a user'}.`,
                type: 'info',
                viewLink: '/friends', 
                viewText: 'View Requests'
            });
        } else {
             console.warn("Could not send friend request toast notification (sendToast unavailable).");
        }

        res.status(201).json({ message: 'Friend request sent successfully.', friendship: newFriendship });

    } catch (error) {
        console.error('Error sending friend request:', error);
        res.status(500).json({ error: 'Failed to send friend request.' });
    }
});

// GET /api/friendships/pending/incoming
router.get('/pending/incoming', isAuthenticated, async (req, res) => {
    const userId = req.session.user.userId;
    try {
        const sql = `
            SELECT f.friendship_id, f.user1_id, f.user2_id, f.action_user_id, f.created_at,
                   u.user_id as sender_id, u.username as sender_username,
                   u.first_name as sender_first_name, u.last_name as sender_last_name,
                   u.profile_photo_url as sender_profile_photo_url
            FROM friendships f
            JOIN users u ON u.user_id = f.action_user_id
            WHERE ((f.user1_id = ? AND f.action_user_id = f.user2_id) OR (f.user2_id = ? AND f.action_user_id = f.user1_id))
              AND f.status = 'pending'
        `;
        const [requests] = await db.query(sql, [userId, userId]);

        const mappedRequests = requests.map(req => ({
            friendshipId: req.friendship_id,
            createdAt: req.created_at,
            sender: {
                userId: req.sender_id,
                username: req.sender_username,
                firstName: req.sender_first_name,
                lastName: req.sender_last_name,
                profile_photo_url: req.sender_profile_photo_url
            }
        }));

        res.json({ pendingRequests: mappedRequests });
    } catch (error) {
        console.error('Error fetching pending friend requests:', error);
        res.status(500).json({ error: 'Failed to fetch pending requests.' });
    }
});

// POST /api/friendships/accept
router.post('/accept', isAuthenticated, async (req, res) => {
    const acceptorId = req.session.user.userId;
    const acceptorUsername = req.session.user.username;
    const friendshipId = parseInt(req.body.friendshipId, 10);

    const sendToast = req.app.get('sendGlobalToast');
     if (!sendToast) {
         console.error("sendGlobalToast function not found on req.app in POST /accept");
    }

    if (!friendshipId || isNaN(friendshipId)) {
        return res.status(400).json({ error: 'Valid friendshipId is required.' });
    }

    try {
        const verifySql = `SELECT friendship_id, user1_id, user2_id, action_user_id FROM friendships WHERE friendship_id = ? AND status = 'pending' AND (user1_id = ? OR user2_id = ?) AND action_user_id != ?`;
        const [rows] = await db.query(verifySql, [friendshipId, acceptorId, acceptorId, acceptorId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Pending friend request not found or you cannot accept this request.' });
        }

        const requestDetails = rows[0];
        const originalRequesterId = requestDetails.action_user_id;

        const updateSql = `UPDATE friendships SET status = 'accepted', action_user_id = ?, created_at = NOW() WHERE friendship_id = ?`;
        const [result] = await db.query(updateSql, [acceptorId, friendshipId]);


        if (result.affectedRows > 0) {
            const updatedFriendship = await fetchFriendshipById(friendshipId);
            console.log(`User ${acceptorId} (${acceptorUsername}) accepted friend request from ${originalRequesterId} (friendship ID: ${friendshipId})`);

            if (sendToast && originalRequesterId) {
                sendToast(originalRequesterId, {
                    title: "Friend Request Accepted",
                    content: `${acceptorUsername || 'Someone'} accepted your friend request!`,
                    type: 'success',
                    viewLink: `/profile/${acceptorId}`,
                    viewText: 'View Profile'
                });
            } else if (!originalRequesterId) {
                 console.warn(`Could not determine original requester ID for friendship ${friendshipId} to send accept toast.`);
            } else {
                 console.warn("Could not send friend request accepted toast notification (sendToast unavailable).");
            }


            res.json({ message: 'Friend request accepted.', friendship: updatedFriendship });
        } else {
             res.status(404).json({ error: 'Friend request not found during update (race condition?).' });
        }
    } catch (error) {
        console.error('Error accepting friend request:', error);
        res.status(500).json({ error: 'Failed to accept friend request.' });
    }
});

// POST /api/friendships/reject
router.post('/reject', isAuthenticated, async (req, res) => {
    const userId = req.session.user.userId;
    const friendshipId = parseInt(req.body.friendshipId, 10);

    const sendToast = req.app.get('sendGlobalToast');
    let originalRequesterId = null; 

    if (!friendshipId || isNaN(friendshipId)) {
        return res.status(400).json({ error: 'Valid friendshipId is required.' });
    }

    try {
        const findSql = `SELECT friendship_id, user1_id, user2_id, action_user_id FROM friendships WHERE friendship_id = ? AND status = 'pending' AND (user1_id = ? OR user2_id = ?)`;
        const [rows] = await db.query(findSql, [friendshipId, userId, userId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Pending friend request not found for this user.' });
        }

        const friendshipDetails = rows[0];
        if (friendshipDetails.action_user_id !== userId) { 
             originalRequesterId = friendshipDetails.action_user_id;
        } else { 
             originalRequesterId = (friendshipDetails.user1_id === userId) ? friendshipDetails.user2_id : friendshipDetails.user1_id;
        }

        const deleteSql = `DELETE FROM friendships WHERE friendship_id = ?`;
        const [result] = await db.query(deleteSql, [friendshipId]);

        if (result.affectedRows > 0) {
            console.log(`User ${userId} rejected/canceled friend request (friendship ID: ${friendshipId})`);

            if (sendToast && originalRequesterId) {
                let toastMessage = '';
                if(friendshipDetails.action_user_id !== userId) { 
                    toastMessage = `${req.session.user.username || 'Someone'} rejected your friend request.`;
                } else { }

                if (toastMessage) {
                    sendToast(originalRequesterId, {
                        title: "Friend Request Update",
                        content: toastMessage,
                        type: 'info'
                    });
                }
            }

            res.json({ message: 'Friend request rejected/canceled.' });
        } else {
             res.status(404).json({ error: 'Friend request not found during deletion (race condition?).' });
        }
    } catch (error) {
        console.error('Error rejecting/canceling friend request:', error);
        res.status(500).json({ error: 'Failed to reject/cancel friend request.' });
    }
});

// DELETE /api/friendships/:friendUserId
router.delete('/:friendUserId', isAuthenticated, async (req, res) => {
    const userId = req.session.user.userId;
    const friendUserId = parseInt(req.params.friendUserId, 10);
    const sendToast = req.app.get('sendGlobalToast');

    if (!friendUserId || isNaN(friendUserId)) {
         return res.status(400).json({ error: 'Valid friend user ID required in URL parameter.' });
    }
     if (userId === friendUserId) {
        return res.status(400).json({ error: 'Cannot unfriend yourself.' });
    }

    try {
         const user1 = Math.min(userId, friendUserId);
         const user2 = Math.max(userId, friendUserId);
        const verifySql = `SELECT friendship_id FROM friendships WHERE user1_id = ? AND user2_id = ? AND status = 'accepted'`;
        const [verifyRows] = await db.query(verifySql, [user1, user2]);

        if (verifyRows.length === 0) {
             return res.status(404).json({ error: 'You are not currently friends with this user.' });
        }

        const deleteSql = `DELETE FROM friendships WHERE user1_id = ? AND user2_id = ? AND status = 'accepted'`;
        const [result] = await db.query(deleteSql, [user1, user2]);

        if (result.affectedRows > 0) {
            console.log(`User ${userId} unfriended user ${friendUserId}`);
            if (sendToast) {
                 sendToast(friendUserId, {
                     title: "Friend Removed",
                     content: `${req.session.user.username || 'Someone'} removed you as a friend.`,
                     type: 'warning' 
                 });
            }

            res.json({ message: 'Friend removed successfully.' });
        } else {
            res.status(404).json({ error: 'Friendship not found or status was not accepted during deletion.' });
        }
    } catch (error) {
        console.error(`Error unfriending user ${friendUserId} for user ${userId}:`, error);
        res.status(500).json({ error: 'Failed to unfriend user.' });
    }
});

// GET /api/friendships/ list accepted friends
router.get('/', isAuthenticated, async (req, res) => {
    const userId = req.session.user.userId;
    try {
        const sql = `
            SELECT u.user_id, u.username, u.first_name, u.last_name, u.profile_photo_url, f.created_at as friends_since
            FROM users u
            JOIN friendships f ON (u.user_id = f.user1_id OR u.user_id = f.user2_id)
            WHERE (f.user1_id = ? OR f.user2_id = ?) AND u.user_id != ? AND f.status = 'accepted'
            ORDER BY u.username ASC
        `;
        const [friends] = await db.query(sql, [userId, userId, userId]);
        res.json({ friends });
    } catch (error) {
        console.error(`Error fetching accepted friends for user ${userId}:`, error);
        res.status(500).json({ error: 'Failed to fetch friends list.' });
    }
});

// GET /api/friendships/recommendations
router.get('/recommendations', isAuthenticated, async (req, res) => {
    const currentUserId = req.session.user.userId;

    try {
        const sql = `
            WITH MyFriends AS (
                -- Users who are accepted friends with the current user
                SELECT
                    CASE
                        WHEN f.user1_id = ? THEN f.user2_id
                        ELSE f.user1_id
                    END AS friend_user_id
                FROM friendships f
                WHERE (f.user1_id = ? OR f.user2_id = ?) AND f.status = 'accepted'
            ),
            FriendsOfFriends AS (
                -- Users who are accepted friends with MyFriends
                SELECT DISTINCT
                    CASE
                        WHEN f_fof.user1_id = mf.friend_user_id THEN f_fof.user2_id
                        ELSE f_fof.user1_id
                    END AS fof_user_id
                FROM friendships f_fof
                JOIN MyFriends mf ON (f_fof.user1_id = mf.friend_user_id OR f_fof.user2_id = mf.friend_user_id)
                WHERE f_fof.status = 'accepted'
                  AND (CASE WHEN f_fof.user1_id = mf.friend_user_id THEN f_fof.user2_id ELSE f_fof.user1_id END) != ? -- Exclude current user
            ),
            ExistingRelationshipPartners AS (
                -- Users with whom the current user has ANY kind of friendship record (user1 or user2)
                SELECT DISTINCT
                    CASE
                        WHEN f.user1_id = ? THEN f.user2_id
                        ELSE f.user1_id
                    END AS related_user_id
                FROM friendships f
                WHERE (f.user1_id = ? OR f.user2_id = ?)
            )
            SELECT u.user_id, u.username, u.first_name, u.last_name, u.profile_photo_url
            FROM users u
            JOIN FriendsOfFriends fof ON u.user_id = fof.fof_user_id
            WHERE u.user_id NOT IN (SELECT related_user_id FROM ExistingRelationshipPartners)
            ORDER BY RAND() -- For variety; use a better metric in production (e.g., mutual friends count)
            LIMIT 10;
        `;
        const params = [
            currentUserId, currentUserId, currentUserId, 
            currentUserId,  
            currentUserId, currentUserId, currentUserId 
        ];

        const [recommendations] = await db.query(sql, params);
        res.json({ recommendations });

    } catch (error) {
        console.error(`Error fetching friend recommendations for user ${currentUserId}:`, error);
        res.status(500).json({ error: 'Failed to fetch friend recommendations.' });
    }
});

module.exports = router; 