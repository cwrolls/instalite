const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('./middleware/authMiddleware');

// helper to fetch post details
const fetchPostDetailsByIds = async (postIds) => {
    if (!postIds || postIds.length === 0) {
        return [];
    }
    const query = `
        SELECT 
            fp.post_id as post_id, 
            fp.post_text, 
            fp.attach_url as image_url, -- Corrected: Use attach_url from federated_posts
            fp.created_at,
            fp.username as author_username, -- Assuming username is on federated_posts
            u.user_id as author_user_id,
            u.profile_photo_url as author_profile_photo_url,
            u.first_name as author_first_name,
            u.last_name as author_last_name
            -- Add any other fields your PostCard needs from the post
        FROM federated_posts fp
        LEFT JOIN users u ON fp.username = u.username -- Or however you link posts to authors
        WHERE fp.post_id IN (?) -- Corrected: Use post_id for the WHERE clause
        ORDER BY fp.created_at DESC
    `;
    const [posts] = await db.query(query, [postIds]);
    
    return posts.map(p => ({
        ...p,
        author: {
            userId: p.author_user_id,
            username: p.author_username,
            profile_photo_url: p.author_profile_photo_url,
            first_name: p.author_first_name,
            last_name: p.author_last_name
        }
    }));
};


// POST /api/bookmarks/:postId - add a bookmark
router.post('/:postId', isAuthenticated, async (req, res) => {
    const userId = req.session.user.userId;
    const postId = parseInt(req.params.postId, 10);

    if (isNaN(postId)) {
        return res.status(400).json({ error: 'Invalid post ID.' });
    }

    try {
        // Check if post exists (optional, but good practice)
        const [postRows] = await db.query('SELECT post_id FROM federated_posts WHERE post_id = ?', [postId]);
        if (postRows.length === 0) {
            return res.status(404).json({ error: 'Post not found.' });
        }

        const sql = 'INSERT INTO bookmarks (user_id, post_id, created_at) VALUES (?, ?, NOW())';
        await db.query(sql, [userId, postId]);
        res.status(201).json({ message: 'Post bookmarked successfully.', postId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Post already bookmarked.', postId });
        }
        console.error(`Error bookmarking post ${postId} for user ${userId}:`, error);
        res.status(500).json({ error: 'Failed to bookmark post.' });
    }
});

// DELETE /api/bookmarks/:postId - remove a bookmark
router.delete('/:postId', isAuthenticated, async (req, res) => {
    const userId = req.session.user.userId;
    const postId = parseInt(req.params.postId, 10);

    if (isNaN(postId)) {
        return res.status(400).json({ error: 'Invalid post ID.' });
    }

    try {
        const sql = 'DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?';
        const [result] = await db.query(sql, [userId, postId]);

        if (result.affectedRows > 0) {
            res.json({ message: 'Bookmark removed successfully.', postId });
        } else {
            res.status(404).json({ error: 'Bookmark not found or already removed.' });
        }
    } catch (error) {
        console.error(`Error removing bookmark for post ${postId} for user ${userId}:`, error);
        res.status(500).json({ error: 'Failed to remove bookmark.' });
    }
});

// GET /api/bookmarks/ids - get ids of posts bookmarked by the current user
router.get('/ids', isAuthenticated, async (req, res) => {
    const userId = req.session.user.userId;
    try {
        const sql = 'SELECT post_id FROM bookmarks WHERE user_id = ?';
        const [rows] = await db.query(sql, [userId]);
        const bookmarkedPostIds = rows.map(row => row.post_id);
        res.json({ bookmarkedPostIds });
    } catch (error) {
        console.error(`Error fetching bookmarked post IDs for user ${userId}:`, error);
        res.status(500).json({ error: 'Failed to fetch bookmarked post IDs.' });
    }
});

// GET /api/bookmarks/user/:profileUsername - get full bookmarked posts for a a user's profile
router.get('/user/:profileUsername', isAuthenticated, async (req, res) => {
    const profileUsername = req.params.profileUsername;

    try {
        const [userRows] = await db.query('SELECT user_id FROM users WHERE username = ?', [profileUsername]);
        if (userRows.length === 0) {
            return res.status(404).json({ error: 'Profile user not found.' });
        }
        const profileUserId = userRows[0].user_id;
        const bookmarkSql = 'SELECT post_id FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC';
        const [bookmarkRows] = await db.query(bookmarkSql, [profileUserId]);
        
        const postIds = bookmarkRows.map(row => row.post_id);

        if (postIds.length === 0) {
            return res.json({ bookmarkedPosts: [] });
        }
        
        const bookmarkedPosts = await fetchPostDetailsByIds(postIds);
        
        res.json({ bookmarkedPosts });

    } catch (error) {
        console.error(`Error fetching bookmarked posts for profile ${profileUsername}:`, error);
        res.status(500).json({ error: 'Failed to fetch bookmarked posts.' });
    }
});

module.exports = router; 