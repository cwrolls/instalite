const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('./middleware/authMiddleware');
const { v4: uuidv4 } = require('uuid'); 
const bcrypt = require('bcrypt'); 

// GET /api/users/profile/:identifier username or userid
router.get('/profile/:identifier', async (req, res) => {
    const { identifier } = req.params;
    let querySql;
    let queryParams;

    if (!isNaN(parseInt(identifier))) {
        querySql = 'SELECT user_id, username, first_name, last_name, email, profile_photo_url, affiliation, birthday, linked_actor_id, candidate_actor_ids FROM users WHERE user_id = ?';
        queryParams = [parseInt(identifier)];
    } else {
        querySql = 'SELECT user_id, username, first_name, last_name, email, profile_photo_url, affiliation, birthday, linked_actor_id, candidate_actor_ids FROM users WHERE username = ?';
        queryParams = [identifier];
    }

    try {
        const [users] = await db.query(querySql, queryParams);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        const userProfile = users[0];
        res.json({
            userId: userProfile.user_id,
            username: userProfile.username,
            firstName: userProfile.first_name,
            lastName: userProfile.last_name,
            email: userProfile.email, 
            profilePhotoUrl: userProfile.profile_photo_url,
            affiliation: userProfile.affiliation,
            birthday: userProfile.birthday,
            linkedActorId: userProfile.linked_actor_id,
            candidateActorIds: userProfile.candidate_actor_ids,
        });
    } catch (error) {
        console.error(`Error fetching profile for identifier ${identifier}:`, error);
        res.status(500).json({ error: 'Server error: Failed to fetch user profile.' });
    }
});


// POST /api/users/link-actor
router.post('/link-actor', isAuthenticated, async (req, res) => {
    const { selectedActorId } = req.body;
    const userId = req.session.user.userId;
    const username = req.session.user.username;

    if (!selectedActorId || typeof selectedActorId !== 'string' || !selectedActorId.includes('nm')) {
        return res.status(400).json({ error: 'Invalid actor identifier provided.' });
    }

    try {
        // update user record
        const updateSql = 'UPDATE users SET linked_actor_id = ? WHERE user_id = ?';
        const [updateResult] = await db.query(updateSql, [selectedActorId, userId]);

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        console.log(`User ${userId} linked profile to actor ID ${selectedActorId}`);


        // create status post
        const postText = `${username} is now linked to actor ${selectedActorName}.`;
        const newPostUUID = uuidv4();

        const insertPostSql = `
            INSERT INTO posts (user_id, post_text, timestamp, post_uuid_within_site)
            VALUES (?, ?, NOW(), ?)
        `;
        const [postResult] = await db.query(insertPostSql, [userId, postText, newPostUUID]);
        const newPostId = postResult.insertId;
        console.log(`Created status post ${newPostId} (UUID: ${newPostUUID}) for user ${userId} linking event (Actor ID: ${selectedActorId}).`);
        res.json({ message: `Successfully linked profile to actor ID ${selectedActorId}.` });

    } catch (error) {
        console.error(`Error in /link-actor for user ${userId}, actor ID ${selectedActorId}:`, error);
        if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage.includes('post_uuid_within_site')) {
             res.status(500).json({ error: 'Server error: Failed to create unique post identifier. Please try again.' });
        } else {
             res.status(500).json({ error: 'Server error: Failed to link profile.' });
        }
    }
});

router.get('/', async (req, res) => {
  const [users] = await db.query('SELECT user_id, username, first_name, last_name, email, profile_photo_url FROM users'); // Added more fields for general listing if used
  res.json(users);
});

// PUT /api/users/settings/email - update user's email
router.put('/settings/email', isAuthenticated, async (req, res) => {
    const { newEmail } = req.body;
    const userId = req.session.user.userId;

    if (!newEmail || typeof newEmail !== 'string' || !/\S+@\S+\.\S+/.test(newEmail)) {
        return res.status(400).json({ error: 'Invalid email format provided.' });
    }

    try {
        const [existingUsers] = await db.query('SELECT user_id FROM users WHERE email = ? AND user_id != ?', [newEmail, userId]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ error: 'This email address is already in use by another account.' });
        }
        const updateSql = 'UPDATE users SET email = ? WHERE user_id = ?';
        const [updateResult] = await db.query(updateSql, [newEmail, userId]);

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json({ message: 'Email updated successfully.' });

    } catch (error) {
        console.error(`Error updating email for user ${userId}:`, error);
        res.status(500).json({ error: 'Server error: Failed to update email.' });
    }
});

// PUT /api/users/settings/password - update password
router.put('/settings/password', isAuthenticated, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session.user.userId;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required.' });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }

    try {
        const [users] = await db.query('SELECT password_hash, salt FROM users WHERE user_id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found.' }); 
        }
        const user = users[0];

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect current password.' });
        }
        const newPasswordHash = await bcrypt.hash(newPassword, user.salt);

        const updateSql = 'UPDATE users SET password_hash = ? WHERE user_id = ?';
        const [updateResult] = await db.query(updateSql, [newPasswordHash, userId]);

        if (updateResult.affectedRows === 0) {
            return res.status(500).json({ error: 'Failed to update password in database.' });
        }

        res.json({ message: 'Password updated successfully.' });

    } catch (error) {
        console.error(`Error updating password for user ${userId}:`, error);
        res.status(500).json({ error: 'Server error: Failed to update password.' });
    }
});

// GET /api/users/profile/:identifier/posts - fetch posts by user
router.get('/profile/:identifier/posts', async (req, res) => {
    const { identifier } = req.params;
    let targetUserId;
    let targetUsername;

    // get userid and username
    try {
        let userQuerySql;
        let userQueryParams;
        if (!isNaN(parseInt(identifier))) {
            userQuerySql = 'SELECT user_id, username FROM users WHERE user_id = ?';
            userQueryParams = [parseInt(identifier)];
        } else {
            userQuerySql = 'SELECT user_id, username FROM users WHERE username = ?';
            userQueryParams = [identifier];
        }
        const [users] = await db.query(userQuerySql, userQueryParams);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found, cannot fetch posts.' });
        }
        targetUserId = users[0].user_id;
        targetUsername = users[0].username;
    } catch (error) {
        console.error(`Error fetching user details for posts (identifier: ${identifier}):`, error);
        return res.status(500).json({ error: 'Server error fetching user details for posts.' });
    }

    try {
        const limit = 20;

        // fetch local posts
        const localPostsQuery = `
            SELECT 
                p.post_id, 
                p.user_id, 
                p.post_text, 
                p.image_url, 
                p.created_at, 
                p.post_uuid_within_site, 
                'local' AS post_type,
                (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.post_id) AS likes_count,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) AS comments_count,
                GROUP_CONCAT(DISTINCT ht.tag_text ORDER BY ht.tag_text ASC SEPARATOR ', ') AS hashtags
            FROM posts p
            LEFT JOIN post_hashtags ph ON p.post_id = ph.post_id
            LEFT JOIN hashtags ht ON ph.hashtag_id = ht.hashtag_id
            WHERE p.user_id = ? 
            GROUP BY p.post_id, p.user_id, p.post_text, p.image_url, p.created_at, p.post_uuid_within_site
            ORDER BY p.created_at DESC`; 
        const [localPostsRows] = await db.query(localPostsQuery, [targetUserId]);

        // fetch federated posts
        const federatedPostsQuery = `
            SELECT 
                fp.post_id, 
                fp.username AS author_username, 
                fp.post_text, 
                fp.attach_url AS image_url, 
                fp.created_at, 
                fp.post_uuid_within_site, 
                fp.source_site, 
                'federated' AS post_type,
                (SELECT COUNT(*) FROM likes l WHERE l.post_id = fp.post_id) AS likes_count,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = fp.post_id) AS comments_count,
                GROUP_CONCAT(DISTINCT ht.tag_text ORDER BY ht.tag_text ASC SEPARATOR ', ') AS hashtags
            FROM federated_posts fp
            LEFT JOIN post_hashtags ph ON fp.post_id = ph.post_id
            LEFT JOIN hashtags ht ON ph.hashtag_id = ht.hashtag_id
            WHERE fp.username = ? 
            GROUP BY fp.post_id, fp.username, fp.post_text, fp.attach_url, fp.created_at, fp.post_uuid_within_site, fp.source_site
            ORDER BY fp.created_at DESC`;
        const [federatedPostsRows] = await db.query(federatedPostsQuery, [targetUsername]);
        const combinedPosts = [
            ...localPostsRows.map(p => ({
                id: p.post_id,
                uuid: p.post_uuid_within_site,
                userId: p.user_id, 
                text: p.post_text,
                imageUrl: p.image_url,
                createdAt: p.created_at,
                type: p.post_type,
                sourceSite: null,
                likesCount: p.likes_count || 0,
                commentsCount: p.comments_count || 0,
                hashtags: p.hashtags ? p.hashtags.split(', ').map(tag => tag.trim()) : []
            })),
            ...federatedPostsRows.map(p => ({
                id: p.post_id,
                uuid: p.post_uuid_within_site,
                authorUsername: p.author_username, 
                text: p.post_text,
                imageUrl: p.image_url,
                createdAt: p.created_at,
                type: p.post_type,
                sourceSite: p.source_site,
                likesCount: p.likes_count || 0,
                commentsCount: p.comments_count || 0,
                hashtags: p.hashtags ? p.hashtags.split(', ').map(tag => tag.trim()) : []
            }))
        ];

        combinedPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const finalPosts = combinedPosts.slice(0, limit);

        res.json(finalPosts);

    } catch (error) {
        console.error(`Error fetching posts for user ${targetUsername} (ID: ${targetUserId}):`, error);
        res.status(500).json({ error: 'Server error: Failed to fetch user posts.' });
    }
});

// GET /api/users/interests - get current user's interests
router.get('/interests', isAuthenticated, async (req, res) => {
    const userId = req.session.user.userId;
    try {
        const query = `
            SELECT ui.hashtag_id, h.tag_text 
            FROM user_hashtag_interests ui
            JOIN hashtags h ON ui.hashtag_id = h.hashtag_id
            WHERE ui.user_id = ?
            ORDER BY h.tag_text ASC
        `;
        const [interests] = await db.query(query, [userId]);
        res.json(interests);
    } catch (error) {
        console.error(`Error fetching interests for user ${userId}:`, error);
        res.status(500).json({ error: 'Failed to fetch user interests.' });
    }
});

// PUT /api/users/interests - update current user's interests
router.put('/interests', isAuthenticated, async (req, res) => {
    const userId = req.session.user.userId;
    const { hashtagTexts } = req.body; 

    if (!Array.isArray(hashtagTexts)) {
        return res.status(400).json({ error: 'Invalid input: hashtagTexts must be an array.' });
    }

    try {
        await db.query('DELETE FROM user_hashtag_interests WHERE user_id = ?', [userId]);
        if (hashtagTexts.length > 0) {
            const hashtagIdsToInsert = [];
            for (const text of hashtagTexts) {
                const trimmedText = text.trim();
                if (trimmedText === '') continue;
                await db.query('INSERT IGNORE INTO hashtags (tag_text) VALUES (?)', [trimmedText]);
                const [[hashtagRow]] = await db.query('SELECT hashtag_id FROM hashtags WHERE tag_text = ?', [trimmedText]);
                
                if (hashtagRow && hashtagRow.hashtag_id) {
                    hashtagIdsToInsert.push(hashtagRow.hashtag_id);
                } else {
                    console.warn(`Could not find or create hashtag_id for text: ${trimmedText}`);
                }
            }

            if (hashtagIdsToInsert.length > 0) {
                const insertInterestValues = hashtagIdsToInsert.map(id => [userId, id]);
                await db.query('INSERT INTO user_hashtag_interests (user_id, hashtag_id) VALUES ?', [insertInterestValues]);
            }
        }

        res.json({ message: 'User interests updated successfully.' });

    } catch (error) {
        console.error(`Error updating interests for user ${userId}:`, error);
        res.status(500).json({ error: 'Failed to update user interests.' });
    } finally {
    }
});

module.exports = router;