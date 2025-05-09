require('dotenv').config();
const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const db = require('../db'); 
const chromaDBManager = require('../utils/chromadb'); 
const { isAuthenticated } = require('./middleware/authMiddleware');

// init openai client
if (!process.env.OPENAI_API_KEY) {
  console.error("!!! FATAL ERROR: OPENAI_API_KEY not found in environment variables.");
}
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


// search for people
async function searchPeople(query, requestingUserId) {
  console.log(`User ${requestingUserId} searching people with query: ${query}`);
  try {
      // simple keyword extraction
      const words = query.trim().split(' ');
      const potentialKeyword = words.length > 0 ? words[words.length - 1] : query;
      const searchTerm = `%${potentialKeyword}%`;
      console.log(`Extracted potential keyword: ${potentialKeyword}, using search term: ${searchTerm}`);

      const sql = `
        SELECT user_id, username, first_name, last_name,
               profile_photo_url, linked_actor_id
        FROM users
        WHERE (username LIKE ? OR first_name LIKE ? OR last_name LIKE ?)
          AND user_id != ?
        LIMIT 10`;

      const [sqlResults] = await db.query(sql, [searchTerm, searchTerm, searchTerm, requestingUserId]);
      console.log(`Found ${sqlResults.length} potential users (excluding self) in DB.`);

      console.log(`Raw DB results for people: ${JSON.stringify(sqlResults, null, 2)}`);

      if (!Array.isArray(sqlResults)) {
           console.error("!!! searchPeople: sqlResults is not an array!");
           return undefined; 
      }

      console.log("Attempting to map results in searchPeople...");
      const mappedResults = sqlResults.map((person, index) => {
          console.log(`Mapping person at index ${index}: ${JSON.stringify(person)}`); 
          if (typeof person.user_id === 'undefined' || typeof person.username === 'undefined') {
               console.warn(`!!! Skipping person at index ${index} due to missing essential data: ${JSON.stringify(person)}`);
               return null; 
          }
          return {
              id: person.user_id, 
              username: person.username,
              first_name: person.first_name,
              last_name: person.last_name,
              profile_photo_url: person.profile_photo_url,
              affiliated_actor: person.linked_actor_id,
              add_friend_link: `/api/friendships/request/${person.user_id}`,
              view_profile_link: `/profile/${person.username}`
           };
      }).filter(p => p !== null); 

      console.log(`Finished mapping. Mapped results: ${JSON.stringify(mappedResults, null, 2)}`);

      return mappedResults; 

  } catch (error) {
      console.error(`!!! Error within searchPeople function for user ${requestingUserId}:`, error);
      throw error;

  }
}

async function searchPosts(query, requestingUserId) { 
  console.log(`User ${requestingUserId} searching posts with query: ${query}`);
  try {
    const sql = `
      SELECT p.post_id as id, p.user_id, p.post_text as content, p.image_url,
             p.created_at, u.username, u.profile_photo_url
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
      WHERE p.post_text LIKE ?
      ORDER BY p.created_at DESC
      LIMIT 10`;
    const searchTerm = `%${query}%`;
    const [sqlResults] = await db.query(sql, [searchTerm]);
    console.log(`Found ${sqlResults.length} potential posts in DB.`);

    const postsWithHashtags = sqlResults.map(post => ({
        ...post,
        content: post.content || '',
        view_post_link: `/posts/${post.id}`,
        hashtags: [],
        follow_hashtag_links: []
      }));

    return postsWithHashtags;

  } catch (error) {
    console.error(`Error searching for posts in RDS for user ${requestingUserId}:`, error);
    throw error;
  }
}

// openai processing
async function processWithOpenAI(userQuery, searchResults) {
    console.log("Processing search results with OpenAI...");
    try {
        let prompt = `User Query: "${userQuery}"\n\nBased ONLY on the following search results from the InstaLite database, provide a helpful summary. Mention specific usernames or post content found. State if no results were found for people or posts.\n\n`;
        console.log("Search results:", searchResults);
        if (searchResults.people && Array.isArray(searchResults.people) && searchResults.people.length > 0) {
        prompt += "Potential People Found:\n";
        searchResults.people.forEach((person, index) => {
            prompt += `${index + 1}. User: ${person.username} (${person.first_name} ${person.last_name})${person.affiliated_actor ? ` - Linked to actor ID: ${person.affiliated_actor}` : ''}\n`;
        });
        prompt += "Users can view profiles or add friends using the app.\n";
        } else {
        prompt += "No people matching the query were found in the database.\n";
        }

        prompt += "\n";
        console.log("Prompt:", prompt);

        if (searchResults.posts && Array.isArray(searchResults.posts) && searchResults.posts.length > 0) {
        prompt += "Potential Posts Found:\n";
        searchResults.posts.forEach((post, index) => {
            const contentPreview = post.content.substring(0, 150) + (post.content.length > 150 ? '...' : '');
            prompt += `${index + 1}. Post by ${post.username}: "${contentPreview}"\n`;
        });
        prompt += "Users can view full posts using the app.\n";
        } else {
        prompt += "No posts matching the query were found in the database.\n";
        }

        prompt += "\nGenerate a concise response based on these findings.";

        const response = await openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [
            { role: "system", content: "You are a helpful assistant for the InstaLite social media platform. Summarize search results based *only* on the provided database context." },
            { role: "user", content: prompt }
        ],
        max_tokens: 300,
        });

        if (!response.choices || !response.choices[0] || !response.choices[0].message) {
            console.error('Invalid OpenAI API response structure:', response);
            throw new Error('Invalid OpenAI API response');
        }
        const aiResponse = response.choices[0].message.content;
        console.log("OpenAI response generated.");
        return { aiResponse: aiResponse, searchResults: searchResults };
    } catch (error) {
        console.error('Error processing with OpenAI:', error);
        throw error;
    }
}


// POST /api/chatbot/search
router.post('/search', isAuthenticated, async (req, res) => {
  try {
    const { query, type } = req.body;
    const requestingUserId = req.session.user.userId; 

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({ error: 'A non-empty search query string is required' });
    }
    console.log(`User ${requestingUserId} initiated search: query='${query}', type='${type}'`);

    let people = [];
    let posts = [];

    if (!type || type === 'people') {
      people = await searchPeople(query, requestingUserId);
    }
    if (!type || type === 'posts') {
      posts = await searchPosts(query, requestingUserId);
    }

    const searchResults = { people, posts };

    const result = await processWithOpenAI(query, searchResults);

    res.json(result); 

  } catch (error) {
    console.error(`Error in /api/chatbot/search route for user ${req.session?.user?.userId}:`, error);
    res.status(500).json({ error: 'An error occurred while processing your search request.' });
  }
});

// POST /api/chatbot/sync
router.post('/sync', isAuthenticated, async (req, res) => {
  const requestingUserId = req.session.user.userId;
  console.log(`User ${requestingUserId} starting sync with ChromaDB...`);
  try {
    await chromaDBManager.initialize();

    console.log("Syncing users...");
    const [users] = await db.query('SELECT user_id as id, username, first_name, last_name, profile_photo_url, linked_actor_id as affiliated_actor FROM users');
    await Promise.all(users.map(user => chromaDBManager.addPerson(user)));
    console.log(`Synced ${users.length} users.`);
    console.log("Syncing posts...");
    const [posts] = await db.query(
      `SELECT p.post_id as id, p.user_id, p.post_text as content, p.image_url,
              p.created_at, u.username
       FROM posts p JOIN users u ON p.user_id = u.user_id`
    );
    await Promise.all(posts.map(post => chromaDBManager.addPost(post)));
    console.log(`Synced ${posts.length} posts.`);

    console.log("Sync with ChromaDB completed by user " + requestingUserId);
    res.json({ success: true, message: 'Database synced with vector database successfully' });

  } catch (error) {
    console.error(`Error syncing database with ChromaDB initiated by user ${requestingUserId}:`, error);
    res.status(500).json({ error: 'An error occurred while syncing the database' });
  }
});

module.exports = router;