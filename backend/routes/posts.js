const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/posts
router.post('/', async (req, res) => {
  try {
    const { post_text, image_url } = req.body;

    if (!post_text) {
      return res.status(400).json({ error: 'Post text is required.' });
    }

    const post = {
      post_text,
      image_url,
      created_at: new Date().toISOString(),
    };
  
    res.status(201).json({ message: 'Post sent to Kafka!' });
  } catch (err) {
    console.error('Error creating post:', err);
    res.status(500).json({ error: 'Failed to create post.' });
  }
});

// POST /api/posts/federated
router.post('/federated', async (req, res) => {
    console.log('Received federated post...');
  try {
    const { post_json, attach } = req.body;

    if (!post_json || !post_json.username || !post_json.post_text) {
      return res.status(400).json({ error: 'Missing required post fields.' });
    }

    console.log('Building federated post object...');
    const federatedPost = {
      ...post_json,
      attach_url: attach,
      created_at: new Date().toISOString(),
    };

    const hashtagsToProcess = post_json.hashtags || [];
    let localPostId = null;

    // save locally to get post_id
    try {
      const insertFederatedPostQuery = `
        INSERT INTO federated_posts 
          (username, source_site, post_uuid_within_site, post_text, content_type, attach_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const fpParams = [
        federatedPost.username,
        federatedPost.source_site || '2y2b',
        federatedPost.post_uuid_within_site,
        federatedPost.post_text,
        federatedPost.content_type || 'text/plain', 
        federatedPost.attach_url,
        federatedPost.created_at
      ];
      const [fpInsertResult] = await db.query(insertFederatedPostQuery, fpParams);
      
      if (fpInsertResult && fpInsertResult.insertId) {
        localPostId = fpInsertResult.insertId;
        console.log(`Federated post saved locally with ID: ${localPostId}`);
      } else {
        console.error('Failed to insert federated post locally or retrieve insertId.');
      }
    } catch (dbError) {
      console.error('Error saving federated post locally:', dbError);
    }

    // process hashtags
    if (localPostId && hashtagsToProcess.length > 0) {
      console.log(`Processing ${hashtagsToProcess.length} hashtags for local post ID: ${localPostId}`);
      for (const tagText of hashtagsToProcess) {
        const trimmedTag = tagText.trim();
        if (trimmedTag === '') continue;

        try {
          const insertHashtagQuery = 'INSERT IGNORE INTO hashtags (tag_text) VALUES (?)';
          await db.query(insertHashtagQuery, [trimmedTag]);
          const selectHashtagQuery = 'SELECT hashtag_id FROM hashtags WHERE tag_text = ?';
          const [hashtagRows] = await db.query(selectHashtagQuery, [trimmedTag]);

          if (hashtagRows.length > 0 && hashtagRows[0].hashtag_id) {
            const hashtagId = hashtagRows[0].hashtag_id;
          
            const insertPostHashtagQuery = 'INSERT INTO post_hashtags (post_id, hashtag_id) VALUES (?, ?)';
            await db.query(insertPostHashtagQuery, [localPostId, hashtagId]);
            console.log(`Linked local post ${localPostId} with hashtag "${trimmedTag}" (ID: ${hashtagId})`);
          } else {
            console.error(`Could not retrieve hashtag_id for tag: "${trimmedTag}" after attempting insert/select.`);
          }
        } catch (hashtagDbError) {
          console.error(`DB error processing hashtag "${trimmedTag}" for local post ${localPostId}:`, hashtagDbError);
        }
      }
      console.log('Hashtag processing for local post completed.');
    } else if (hashtagsToProcess.length > 0) {
      console.warn('Hashtags present but no localPostId available. Skipping hashtag linking.');
    }

    // send federated posts
    console.log('Sending federated post to remote server...');
    try {
      const axios = require('axios');
      const response = await axios.post('http://localhost:4567/post', {
        post_json: {
          username: federatedPost.username,
          source_site: federatedPost.source_site || '2y2b',
          post_text: federatedPost.post_text,
          content_type: federatedPost.content_type || 'text/plain'
        },
        attach: federatedPost.attach_url
      });
      console.log('Post sent to remote server:', response.data);

    } catch (error) {
      console.error('Error sending post to remote server:', error);
    }
    console.log('Federated post received!', federatedPost);
    res.status(201).json({ message: 'Federated post received!', federatedPost });
  } catch (err) {
    console.error('Error creating federated post:', err);
    res.status(500).json({ error: 'Failed to create federated post.' });
  }
});

module.exports = router;
