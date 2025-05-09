const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('./middleware/authMiddleware');

router.get('/', async (req, res) => {
    try {
      const [hashtags] = await db.query('SELECT hashtag_id FROM post_hashtags ORDER BY hashtag_id');
      res.json(hashtags);
    } catch (error) {
      console.error('Error fetching hashtags:', error);
      res.status(500).json({ error: 'Failed to fetch hashtags' });
    }
  });

// GET /api/hashtags/suggestions - get popular/suggested hashtags
router.get('/suggestions', async (req, res) => {
    const limit = req.query.limit || 10; 
    try {
        const query = `
            SELECT h.hashtag_id, h.tag_text, COUNT(ph.post_id) AS usage_count
            FROM hashtags h
            JOIN post_hashtags ph ON h.hashtag_id = ph.hashtag_id
            GROUP BY h.hashtag_id, h.tag_text
            ORDER BY usage_count DESC, h.tag_text ASC
            LIMIT ?
        `;
        const [suggestions] = await db.query(query, [parseInt(limit, 10)]);
        res.json(suggestions);
    } catch (error) {
        console.error('Error fetching hashtag suggestions:', error);
        res.status(500).json({ error: 'Failed to fetch hashtag suggestions.' });
    }
});

// GET /api/hashtags/search - search for hashtags
router.get('/search', async (req, res) => {
    const searchText = req.query.q;
    const limit = req.query.limit || 10;

    if (!searchText || searchText.trim() === '') {
        return res.status(400).json({ error: 'Search query cannot be empty.' });
    }

    try {
        const query = `
            SELECT hashtag_id, tag_text
            FROM hashtags
            WHERE tag_text LIKE ?
            ORDER BY tag_text ASC
            LIMIT ?
        `;
        const [results] = await db.query(query, [`%${searchText.trim()}%`, parseInt(limit, 10)]);
        res.json(results);
    } catch (error) {
        console.error(`Error searching hashtags for "${searchText}":`, error);
        res.status(500).json({ error: 'Failed to search hashtags.' });
    }
});

module.exports = router;
