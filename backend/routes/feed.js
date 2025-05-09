const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('./middleware/authMiddleware');


router.get('/', isAuthenticated, async (req, res) => {
  const userId = req.session.user.userId;
  // pagination parameters
  const page = parseInt(req.query.page, 10) || 1; 
  const limit = parseInt(req.query.limit, 10) || 20;
  const offset = (page - 1) * limit;

  if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
      const rankingsQuery = `
          SELECT post_id, rank_score, source_site, post_uuid_within_site
          FROM post_rankings
          WHERE user_id = ?
          ORDER BY rank_score DESC
          LIMIT ? OFFSET ?
      `;

      const [topRankedPosts] = await db.query(rankingsQuery, [userId, limit, offset]);
      console.log(`Fetching page ${page} with limit ${limit}, offset ${offset} for user ${userId}`); 
      console.log('Top ranked posts:', topRankedPosts); 
      if (topRankedPosts.length === 0) {
          console.log('No ranked posts found for user:', userId); 
          return res.json([]); 
      }

      const regularPostIds = [];
      const federatedPostIds = [];
      const blueskyPostUris = []; 
      const rankScoreMap = new Map(); 
      
      topRankedPosts.forEach(post => {
          if (post.source_site === null) {  // regular post
              regularPostIds.push(post.post_id);
              rankScoreMap.set(`regular_${post.post_id}`, post.rank_score);
          } else if (post.source_site === 'bluesky') {  // bluesky post
              if (post.post_uuid_within_site) {
                  console.log('Bluesky post URI:', post.post_uuid_within_site); 
                  blueskyPostUris.push(post.post_uuid_within_site);
                  rankScoreMap.set(`bluesky_${post.post_uuid_within_site}`, post.rank_score);
              }
          } else { // federated post
              federatedPostIds.push(post.post_id);
              rankScoreMap.set(`federated_${post.post_id}`, post.rank_score);
          }
      });

      console.log('Regular post IDs:', regularPostIds);
      console.log('Federated post IDs:', federatedPostIds); 
      console.log('Bluesky post URIs:', blueskyPostUris);

      // fetch details for regular posts 
      let regularPosts = [];
      if (regularPostIds.length > 0) {
          const placeholders = regularPostIds.map(() => '?').join(',');
          const regularPostsQuery = `
              SELECT 
                  p.post_id,
                  p.user_id,
                  p.post_text AS content,
                  p.image_url,
                  p.created_at,
                  'local' AS post_type,
                  u.username AS author_username,
                  u.profile_photo_url AS author_profile_photo_url,
                  (SELECT COUNT(*) FROM likes WHERE post_id = p.post_id) AS likes_count,
                  (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) AS comments_count,
                  EXISTS(SELECT 1 FROM likes WHERE post_id = p.post_id AND user_id = ?) AS user_has_liked,
                  GROUP_CONCAT(DISTINCT ht.tag_text ORDER BY ht.tag_text ASC SEPARATOR ', ') AS hashtag_texts
              FROM 
                  posts p
              JOIN 
                  users u ON p.user_id = u.user_id
              LEFT JOIN 
                  post_hashtags ph ON p.post_id = ph.post_id
              LEFT JOIN 
                  hashtags ht ON ph.hashtag_id = ht.hashtag_id
              WHERE 
                  p.post_id IN (${placeholders})
              GROUP BY 
                  p.post_id
          `;

          const regularQueryParams = [userId, ...regularPostIds];
          const [postsData] = await db.query(regularPostsQuery, regularQueryParams);
          console.log('Regular posts found:', postsData.length); 
          regularPosts = postsData;
      }

      // fetch details for federated posts
      let federatedPosts = [];
      if (federatedPostIds.length > 0) {
          const placeholders = federatedPostIds.map(() => '?').join(',');
          const federatedPostsQuery = `
              SELECT 
                  fp.post_id,
                  fp.username AS user_id,
                  fp.post_text AS content,
                  fp.attach_url AS image_url,
                  fp.created_at,
                  'federated' AS post_type,
                  fp.username AS author_username,
                  NULL AS author_profile_photo_url,
                  (SELECT COUNT(*) FROM likes WHERE post_id = fp.post_id) AS likes_count,
                  (SELECT COUNT(*) FROM comments WHERE post_id = fp.post_id) AS comments_count,
                  EXISTS(SELECT 1 FROM likes WHERE post_id = fp.post_id AND user_id = ?) AS user_has_liked,
                  GROUP_CONCAT(DISTINCT ht.tag_text ORDER BY ht.tag_text ASC SEPARATOR ', ') AS hashtag_texts
              FROM 
                  federated_posts fp
              LEFT JOIN 
                  post_hashtags ph ON fp.post_id = ph.post_id
              LEFT JOIN 
                  hashtags ht ON ph.hashtag_id = ht.hashtag_id
              WHERE 
                  fp.post_id IN (${placeholders})
              GROUP BY 
                  fp.post_id
          `;

          try {
              const federatedQueryParams = [userId, ...federatedPostIds];
              const [postsData] = await db.query(federatedPostsQuery, federatedQueryParams);
              console.log('Federated posts found:', postsData.length);
              federatedPosts = postsData;
          } catch (error) {
              console.error('Error fetching federated posts:', error);
          }
      }

      // fetch details for bluesky posts
      let blueskyData = [];
      if (blueskyPostUris.length > 0) {
          const placeholders = blueskyPostUris.map(() => '?').join(',');
          const blueskyPostsQuery = `
              SELECT 
                  bp.uri,      
                  bp.author_did,
                  bp.text AS content,
                  JSON_UNQUOTE(JSON_EXTRACT(bp.embded_image_json, '$.url')) AS image_url,
                  bp.created_at,
                  'bluesky' AS post_type,
                  bp.author_did AS author_username,
                  NULL AS author_profile_photo_url,
                  bp.like_count AS likes_count,
                  bp.reply_count AS comments_count,
                  0 AS user_has_liked,
                  NULL AS hashtag_texts
              FROM 
                  Bluesky_posts bp
              WHERE 
                  bp.uri IN (${placeholders})
          `;
          try {
              const [postsData] = await db.query(blueskyPostsQuery, blueskyPostUris);
              console.log('Bluesky posts found:', postsData.length);
              blueskyData = postsData;
          } catch (error) {
              console.error('Error fetching Bluesky posts:', error);
          }
      }

      // combine and process all posts
      const allPosts = [...regularPosts, ...federatedPosts, ...blueskyData];
      console.log('Total posts combined:', allPosts.length);
      
      if (allPosts.length === 0) {
          console.log('No posts found after fetching details');
          return res.json([]);
      }
      
      const processedPosts = allPosts.map(post => {
          const userHasLiked = Boolean(post.user_has_liked);
          const hashtags = post.hashtag_texts ? post.hashtag_texts.split(', ').map(tag => tag.trim()) : [];
          const author = {
              username: post.author_username,
              profile_photo_url: post.author_profile_photo_url
          };
          delete post.author_username;
          delete post.author_profile_photo_url;
          delete post.hashtag_texts;
          delete post.user_has_liked;

          let rankKey;
          let commonId;
          if (post.post_type === 'regular') {
              rankKey = `regular_${post.post_id}`;
              commonId = post.post_id;
          } else if (post.post_type === 'federated') {
              rankKey = `federated_${post.post_id}`;
              commonId = post.post_id;
          } else if (post.post_type === 'bluesky') {
              rankKey = `bluesky_${post.uri}`;
              commonId = post.uri;
          }

          return {
              ...post,
              id: commonId,
              hashtags, 
              user_has_liked: userHasLiked, 
              author,
              is_federated: post.post_type === 'federated',
              is_bluesky: post.post_type === 'bluesky',
              rank_score: rankScoreMap.get(rankKey) 
          };
      });

      processedPosts.sort((a, b) => {
        const rankA = typeof a.rank_score === 'number' && !isNaN(a.rank_score) ? a.rank_score : -Infinity;
        const rankB = typeof b.rank_score === 'number' && !isNaN(b.rank_score) ? b.rank_score : -Infinity;
        return rankB - rankA;
      });
      console.log('Processed and sorted posts:', processedPosts.length); 

      res.json(processedPosts);

  } catch (error) {
      console.error('Error fetching feed:', error);
      res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// router.get('/:userId', async (req, res) => {
//   const userId = req.params.userId;
//   const [rows] = await db.query(
//     `SELECT p.*, f.weight
//      FROM feed_items f
//      JOIN posts p ON f.post_id = p.id
//      WHERE f.user_id = ?
//      ORDER BY f.weight DESC
//      LIMIT 50`, [userId]
//   );
//   res.json(rows);
// });

// like or unlike a post
router.post('/:postId/like', isAuthenticated, async (req, res) => {
    const userId = req.session.user.userId;
    const postId = req.params.postId;
    console.log(`[POST /api/feed/${postId}/like] Request received from userId: ${userId}`);

    if (!userId) {
        return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!postId) {
        return res.status(400).json({ error: 'Post ID is required.' });
    }

    try {
        const [rankedPostExists] = await db.query('SELECT 1 FROM post_rankings WHERE post_id = ? LIMIT 1', [postId]);
        if (rankedPostExists.length === 0) {
            console.warn(`[POST /api/feed/${postId}/like] Attempt to like post_id ${postId} which does not exist in 'post_rankings' table. User: ${userId}`);
            return res.status(404).json({
                error: 'Post not found in rankings.',
                detail: 'This post is not currently eligible for liking as it does not appear in the ranking system.'
            });
        }

        await db.query('START TRANSACTION');

        // check if like alr exists
        const checkSql = 'SELECT 1 FROM likes WHERE user_id = ? AND post_id = ? LIMIT 1';
        const [existingLikes] = await db.query(checkSql, [userId, postId]);

        let liked = false;
        if (existingLikes.length > 0) {
            const deleteSql = 'DELETE FROM likes WHERE user_id = ? AND post_id = ?';
            await db.query(deleteSql, [userId, postId]);
            liked = false;
            console.log(`User ${userId} unliked post ${postId}`);
        } else {
            const insertSql = 'INSERT INTO likes (user_id, post_id) VALUES (?, ?)';
            await db.query(insertSql, [userId, postId]);
            liked = true;
            console.log(`User ${userId} liked post ${postId}`);
        }

        const countSql = 'SELECT COUNT(*) as count FROM likes WHERE post_id = ?';
        const [countResult] = await db.query(countSql, [postId]);
        const newLikeCount = countResult[0].count;

        await db.query('COMMIT');
        
        res.json({ 
            success: true, 
            liked: liked, 
            newLikeCount: newLikeCount 
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error(`Error toggling like for user ${userId} on post ${postId}:`, error);
        res.status(500).json({ error: 'Failed to update like status.' });
    }
});

// comment
router.post('/:postId/comment', isAuthenticated, async (req, res) => {
    const userId = req.session.user.userId;
    const postId = req.params.postId;
    const { comment_text } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Authentication required to comment.' });
    }

    if (!postId) {
        return res.status(400).json({ error: 'Post ID is required to comment.' });
    }

    if (!comment_text || comment_text.trim() === '') {
        return res.status(400).json({ error: 'Comment text cannot be empty.' });
    }

    try {
        const [rankedPostExists] = await db.query('SELECT 1 FROM post_rankings WHERE post_id = ? LIMIT 1', [postId]);
        if (rankedPostExists.length === 0) {
            return res.status(404).json({
                error: 'Post not found in rankings.',
                detail: 'This post is not currently eligible for commenting as it does not appear in the ranking system.'
            });
        }

        const insertSql = 'INSERT INTO comments (user_id, post_id, comment_text, created_at, parent_comment_id) VALUES (?, ?, ?, NOW(), NULL)';
        const [result] = await db.query(insertSql, [userId, postId, comment_text]);

        if (result.affectedRows > 0) {
            console.log(`User ${userId} commented on post ${postId}. Comment ID: ${result.insertId}`);
            res.status(201).json({ 
                success: true, 
                message: 'Comment added successfully.', 
                commentId: result.insertId, 
                comment: {
                    comment_id: result.insertId,
                    user_id: userId,
                    post_id: parseInt(postId, 10),
                    comment_text: comment_text,
                    created_at: new Date().toISOString(),
                    parent_comment_id: null
                }
            });
        } else {
            throw new Error('Failed to insert comment into database.');
        }

    } catch (error) {
        console.error(`Error adding comment for user ${userId} on post ${postId}:`, error);
        res.status(500).json({ error: 'Failed to add comment.', detail: error.message });
    }
});

// fetch comments for a post
router.get('/:postId/comments', async (req, res) => {
    const postId = req.params.postId;

    if (!postId) {
        return res.status(400).json({ error: 'Post ID is required to fetch comments.' });
    }

    try {
        const [rankedPostExists] = await db.query('SELECT 1 FROM post_rankings WHERE post_id = ? LIMIT 1', [postId]);
        if (rankedPostExists.length === 0) {
            return res.status(404).json({
                error: 'Post not found in rankings.',
                detail: 'Cannot fetch comments for a post not recognized by the ranking system.'
            });
        }

        const commentsQuery = `
            SELECT 
                c.comment_id,
                c.post_id,
                c.user_id,
                c.comment_text,
                c.created_at,
                c.parent_comment_id,
                u.username AS author_username,
                u.profile_photo_url AS author_profile_photo_url
            FROM 
                comments c
            JOIN 
                users u ON c.user_id = u.user_id
            WHERE 
                c.post_id = ?
            ORDER BY 
                c.created_at ASC;
        `;

        const [comments] = await db.query(commentsQuery, [postId]);

        console.log(`Fetched ${comments.length} comments for post ${postId}`);
        res.json(comments);

    } catch (error) {
        console.error(`Error fetching comments for post ${postId}:`, error);
        res.status(500).json({ error: 'Failed to fetch comments.', detail: error.message });
    }
});

module.exports = router;