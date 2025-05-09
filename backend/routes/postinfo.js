
const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('./middleware/authMiddleware');

// local post
router.get('/:id', isAuthenticated, async (req, res) => {
  const postId = req.params.id;
  const userId = req.session.user.userId;

  try {
    const sql = `
      SELECT
        p.post_id        AS id,
        p.post_text      AS content,
        p.image_url,
        p.created_at,
        u.user_id        AS author_id,
        u.username       AS author_username,
        u.profile_photo_url AS author_profile_photo_url,
        (SELECT COUNT(*) FROM likes    WHERE post_id = p.post_id) AS likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) AS comments_count,
        EXISTS(
          SELECT 1 FROM likes WHERE post_id = p.post_id AND user_id = ?
        ) AS user_has_liked,
        GROUP_CONCAT(DISTINCT ht.tag_text ORDER BY ht.tag_text SEPARATOR ',') AS hashtag_texts
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
      LEFT JOIN post_hashtags ph ON p.post_id = ph.post_id
      LEFT JOIN hashtags ht     ON ph.hashtag_id = ht.hashtag_id
      WHERE p.post_id = ?
      GROUP BY p.post_id
      LIMIT 1
    `;
    const [rows] = await db.query(sql, [userId, postId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const row = rows[0];
    res.json({
      id:                row.id,
      content:           row.content,
      image_url:         row.image_url,
      created_at:        row.created_at,
      author: {
        id:              row.author_id,
        username:        row.author_username,
        profile_photo_url: row.author_profile_photo_url
      },
      likes_count:       row.likes_count,
      comments_count:    row.comments_count,
      user_has_liked:    Boolean(row.user_has_liked),
      hashtags:          row.hashtag_texts
                            ? row.hashtag_texts.split(',').map(t => t.trim())
                            : []
    });
  } catch (err) {
    console.error(`GET /api/posts/${postId} error:`, err);
    res.status(500).json({ error: 'Failed to load post.' });
  }
});

// federated post
router.get('/federated/:id', isAuthenticated, async (req, res) => {
  const postId = req.params.id;
  const userId = req.session.user.userId;

  try {
    const sql = `
      SELECT
        fp.post_id        AS id,
        fp.post_text      AS content,
        fp.attach_url     AS image_url,
        fp.created_at,
        fp.username       AS author_username,
        NULL              AS author_profile_photo_url,
        (SELECT COUNT(*) FROM likes    WHERE post_id = fp.post_id) AS likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = fp.post_id) AS comments_count,
        EXISTS(
          SELECT 1 FROM likes WHERE post_id = fp.post_id AND user_id = ?
        ) AS user_has_liked,
        GROUP_CONCAT(DISTINCT ht.tag_text ORDER BY ht.tag_text SEPARATOR ',') AS hashtag_texts
      FROM federated_posts fp
      LEFT JOIN post_hashtags ph ON fp.post_id = ph.post_id
      LEFT JOIN hashtags ht     ON ph.hashtag_id = ht.hashtag_id
      WHERE fp.post_id = ?
      GROUP BY fp.post_id
      LIMIT 1
    `;
    const [rows] = await db.query(sql, [userId, postId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Federated post not found.' });
    }

    const row = rows[0];
    res.json({
      id:             row.id,
      content:        row.content,
      image_url:      row.image_url,
      created_at:     row.created_at,
      author: {
        username:     row.author_username,
        profile_photo_url: row.author_profile_photo_url
      },
      likes_count:    row.likes_count,
      comments_count: row.comments_count,
      user_has_liked: Boolean(row.user_has_liked),
      hashtags:       row.hashtag_texts
                       ? row.hashtag_texts.split(',').map(t => t.trim())
                       : []
    });
  } catch (err) {
    console.error(`GET /api/posts/federated/${postId} error:`, err);
    res.status(500).json({ error: 'Failed to load federated post.' });
  }
});

// bluesky post
router.get('/bluesky/:uri', async (req, res) => {
  const uri = req.params.uri;

  try {
    const sql = `
      SELECT
        bp.uri           AS id,
        bp.text          AS content,
        bp.embded_image_json AS image_url,
        bp.created_at,
        bp.author_did    AS author_username,
        NULL             AS author_profile_photo_url,
        bp.like_count    AS likes_count,
        bp.reply_count   AS comments_count
      FROM Bluesky_posts bp
      WHERE bp.uri = ?
      LIMIT 1
    `;
    const [rows] = await db.query(sql, [uri]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Bluesky post not found.' });
    }

    const row = rows[0];
    res.json({
      id:             row.id,
      content:        row.content,
      image_url:      row.image_url,
      created_at:     row.created_at,
      author: {
        username:     row.author_username,
        profile_photo_url: row.author_profile_photo_url
      },
      likes_count:    row.likes_count,
      comments_count: row.comments_count,
      user_has_liked: false,  
      hashtags:       [] 
    });
  } catch (err) {
    console.error(`GET /api/posts/bluesky/${uri} error:`, err);
    res.status(500).json({ error: 'Failed to load Bluesky post.' });
  }
});

module.exports = router;