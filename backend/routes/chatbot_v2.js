require('dotenv').config();
const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const db = require('../db'); 
const { ChromaClient } = require('chromadb'); 
const { isAuthenticated } = require('./middleware/authMiddleware');

// init openai client
if (!process.env.OPENAI_API_KEY) {
  console.error("!!! FATAL ERROR: OPENAI_API_KEY not found in environment variables.");
  process.exit(1);
}
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// init chromadb client
const CHROMA_DB_URL = `http://${process.env.CHROMA_HOST}:${process.env.CHROMA_PORT}`;
if (!process.env.CHROMA_HOST || !process.env.CHROMA_PORT) {
    console.error("!!! FATAL ERROR: CHROMA_HOST or CHROMA_PORT not found in environment variables.");
    process.exit(1);
}
console.log(`Initializing ChromaClient with path: ${CHROMA_DB_URL}`);
const chromaClient = new ChromaClient({ path: CHROMA_DB_URL });

const ACTOR_COLLECTION_NAME = "actor_embeddings";

async function getActorCollection() {
    try {
        const collection = await chromaClient.getCollection({ name: ACTOR_COLLECTION_NAME });
        console.log(`Successfully connected to ChromaDB collection: ${ACTOR_COLLECTION_NAME}`);
        return collection;
    } catch (error) {
        console.error(`Error getting ChromaDB collection '${ACTOR_COLLECTION_NAME}':`, error);
        console.error("Please ensure the ChromaDB server is running and the collection has been created and populated by the Python script.");
        throw new Error(`ChromaDB collection '${ACTOR_COLLECTION_NAME}' not accessible.`);
    }
}
let actorCollection;
(async () => {
    try {

        actorCollection = await getActorCollection();
        const count = await actorCollection.count();
        console.log(`ChromaDB collection '${ACTOR_COLLECTION_NAME}' contains ${count} embeddings.`);
    } catch (e) {
        console.error("Failed to initialize actorCollection on startup. Queries to ChromaDB will fail.", e);
    }
})();


// search functions
async function generateEmbedding(text) {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        dimensions: 1536
      });
  
      if (!response.data || response.data.length === 0 || !response.data[0].embedding) {
        console.error("Invalid OpenAI embedding API response:", response);
        throw new Error("Failed to generate embedding.");
      }
      return response.data[0].embedding;
    } catch (error) {
      console.error("Error generating embedding with OpenAI:", error.response ? error.response.data : error.message);
      throw error; 
    }
  }

async function searchActorsMoviesChroma(query, topN = 10) {
  console.log(`Searching ChromaDB for actors/movies with query: ${query}`);
  if (!actorCollection) {
      console.error("ChromaDB actor collection is not initialized. Skipping search.");
      return [];
  }
  try {
    const queryEmbedding = await generateEmbedding(query);

    const results = await actorCollection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topN,
      include: ["metadatas", "documents", "distances"]
    });

    if (!results.ids || !results.ids[0] || !results.documents || !results.documents[0] || !results.metadatas || !results.metadatas[0]) {
        console.warn("ChromaDB query returned unexpected structure or no results.");
        return [];
    }
    
    const combinedResults = results.ids[0].map((id, index) => ({
        id: id,
        document: results.documents[0][index],
        metadata: results.metadatas[0][index],
        distance: results.distances && results.distances[0] ? results.distances[0][index] : null
    }));
    
    console.log(`Found ${combinedResults.length} potential actor/movie entries in ChromaDB.`);
    return combinedResults;
  } catch (error) {
    console.error(`Error searching ChromaDB for actors/movies:`, error);
    return [];
  }
}

async function searchUsersSql(query, requestingUserId) {
  console.log(`User ${requestingUserId} searching platform users with query: ${query}`);
  try {
    const searchTerms = query.trim().split(' ').map(term => `%${term}%`);
    let sql = `
      SELECT user_id, username, first_name, last_name, email, affiliation, profile_photo_url, linked_actor_id
      FROM users
      WHERE (`;
    
    const conditions = [];
    const params = [];

    if (searchTerms.length === 0 || (searchTerms.length === 1 && searchTerms[0] === '%%')) { 
        sql += `1=1`;
    } else {
        searchTerms.forEach(term => {
            conditions.push(`username LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR email LIKE ?`);
            params.push(term, term, term, term);
        });
        sql += conditions.join(' OR ');
    }
    sql += `) AND user_id != ? LIMIT 10`;
    params.push(requestingUserId);

    const [rows] = await db.query(sql, params);
    console.log(`Found ${rows.length} potential platform users (excluding self).`);
    return rows.map(user => ({
      id: user.user_id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      affiliation: user.affiliation,
      profile_photo_url: user.profile_photo_url,
      linked_actor_id: user.linked_actor_id,
      profile_link: `/profile/${user.username}`
    }));
  } catch (error) {
    console.error(`Error searching platform users for user ${requestingUserId}:`, error);
    return []; 
  }
}

async function searchFederatedPostsSql(query) {
  console.log(`Searching federated posts with query: ${query}`);
  try {
    const searchTerms = query.trim().split(' ').map(term => `%${term}%`);
    let sql = `
      SELECT post_id, username, source_site, post_uuid_within_site, post_text, content_type, attach_url, created_at
      FROM federated_posts
      WHERE (`;

    const conditions = [];
    const params = [];
    if (searchTerms.length === 0 || (searchTerms.length === 1 && searchTerms[0] === '%%')) {
        sql += `1=1`; 
    } else {
        searchTerms.forEach(term => {
            conditions.push(`post_text LIKE ? OR username LIKE ?`);
            params.push(term, term);
        });
        sql += conditions.join(' OR ');
    }
    sql += `) ORDER BY created_at DESC LIMIT 10`;
    
    const [rows] = await db.query(sql, params);
    console.log(`Found ${rows.length} potential federated posts.`);
    return rows.map(post => ({
      federated_id: post.post_id, 
      username: post.username,
      source_site: post.source_site,
      post_uuid_within_site: post.post_uuid_within_site,
      content: post.post_text,
      content_type: post.content_type,
      attach_url: post.attach_url,
      created_at: post.created_at
    }));
  } catch (error) {
    console.error(`Error searching federated posts:`, error);
    return [];
  }
}

async function searchBlueskyPostsSql(query) {
  console.log(`Searching Bluesky posts with query: ${query}`);
  try {
    const searchTerms = query.trim().split(' ').map(term => `%${term}%`);
    let sql = `
      SELECT uri, author_did, text, created_at, reply_count, repost_count, like_count, reply_to_uri, embded_image_json
      FROM Bluesky_posts
      WHERE (`;
    
    const conditions = [];
    const params = [];
    if (searchTerms.length === 0 || (searchTerms.length === 1 && searchTerms[0] === '%%')) {
        sql += `1=1`; // all posts
    } else {
        searchTerms.forEach(term => {
            conditions.push(`text LIKE ? OR author_did LIKE ?`);
            params.push(term, term);
        });
        sql += conditions.join(' OR ');
    }
    sql += `) ORDER BY created_at DESC LIMIT 10`;

    const [rows] = await db.query(sql, params);
    console.log(`Found ${rows.length} potential Bluesky posts.`);
    return rows.map(post => ({
      bluesky_id: post.uri,
      author_did: post.author_did,
      content: post.text,
      created_at: post.created_at,
      reply_count: post.reply_count,
      repost_count: post.repost_count,
      like_count: post.like_count,
      reply_to_uri: post.reply_to_uri,
      embded_image_json: post.embded_image_json ? JSON.parse(post.embded_image_json) : null 
    }));
  } catch (error) {
    console.error(`Error searching Bluesky posts:`, error);
    return [];
  }
}

// openai processing with rag
async function generateAiResponse(userQuery, actorMovieResults, userResults, federatedPostResults, blueskyPostResults) {
  console.log("Processing combined search results with OpenAI for RAG...");

  const systemPrompt = `You are an AI assistant for a social media and entertainment platform. Your primary function is to process a user's query and various search results (from a vector database about actors/movies, and SQL databases about platform users, federated posts, and Bluesky posts) to generate a structured JSON output. This output will be consumed by a downstream agent, so it must be precise and contain no conversational fluff outside the designated 'ai_summary' field.

You will be provided with:
1. User's original query.
2. \`actor_movie_results\`: Top matches from a vector database. Each item includes a 'document' (text summary of actor/movie) and 'metadata' (structured data).
3. \`user_results\`: Users from our platform matching the query. Each includes a 'profile_link'.
4. \`federated_post_results\`: Posts from federated sources matching the query. Each includes a 'federated_id'.
5. \`bluesky_post_results\`: Posts from Bluesky matching the query. Each includes a 'bluesky_id'.

Your task is to generate a JSON object with the following structure:
{
  "ai_summary": "A concise natural language summary answering the user's query based *only* on the provided search results. If information from a specific source (e.g., actor_movie_results) is most relevant to the query, prioritize it in the summary. Mention if no relevant information was found in any category. For example: 'Based on the provided information, Charles Kayser was an actor in Blacksmith Scene. No platform users directly matched your query, but several posts discussed similar topics.'",
  "retrieved_actor_movie_info": [/* an array of objects, exactly as provided in actor_movie_results */],
  "retrieved_users": [/* an array of objects, exactly as provided in user_results */],
  "retrieved_federated_posts": [/* an array of objects, exactly as provided in federated_post_results */],
  "retrieved_bluesky_posts": [/* an array of objects, exactly as provided in bluesky_post_results */]
}

Instructions:
- Analyze the user's query to understand their intent.
- Synthesize information from ALL provided result sets to form the \`ai_summary\`.
- If the query seems primarily about actors or movies, focus the summary on \`actor_movie_results\`.
- If the query seems about finding people on the platform, focus on \`user_results\`.
- If about general posts or topics, consider \`federated_post_results\` and \`bluesky_post_results\`.
- If results for a category are empty or not relevant to the query, you can state this briefly in the \`ai_summary\`.
- The \`retrieved_actor_movie_info\`, \`retrieved_users\`, \`retrieved_federated_posts\`, and \`retrieved_bluesky_posts\` fields in the JSON output MUST contain the verbatim, unmodified array of results that were passed into this function for those categories. Do not summarize or alter them in these fields.
- Ensure the entire output is a single, valid JSON object. Do not add any text before or after the JSON structure.`;

  // construct user message for llm
  let llmUserInput = `User Query: "${userQuery}"\n\n`;
  llmUserInput += "Actor/Movie Search Results (from Vector DB):\n";
  llmUserInput += JSON.stringify(actorMovieResults, null, 2) + "\n\n";
  llmUserInput += "Platform User Search Results (from SQL):\n";
  llmUserInput += JSON.stringify(userResults, null, 2) + "\n\n";
  llmUserInput += "Federated Post Search Results (from SQL):\n";
  llmUserInput += JSON.stringify(federatedPostResults, null, 2) + "\n\n";
  llmUserInput += "Bluesky Post Search Results (from SQL):\n";
  llmUserInput += JSON.stringify(blueskyPostResults, null, 2) + "\n\n";
  llmUserInput += "Based on the user query and ALL the provided search results, generate the JSON output according to the system prompt's specified format.";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: llmUserInput }
      ],
      response_format: { type: "json_object" }, // pls work lol
      max_tokens: 3000,
      temperature: 0.2, // lower temp for more deterministic output
    });

    if (!response.choices || !response.choices[0] || !response.choices[0].message || !response.choices[0].message.content) {
      console.error('Invalid OpenAI API response structure:', response);
      throw new Error('Invalid OpenAI API response content.');
    }
    
    const aiResponseContent = response.choices[0].message.content;
    console.log("OpenAI JSON response generated.");

    const parsedResponse = JSON.parse(aiResponseContent);

    if (typeof parsedResponse.ai_summary !== 'string' ||
        !Array.isArray(parsedResponse.retrieved_actor_movie_info) ||
        !Array.isArray(parsedResponse.retrieved_users) ||
        !Array.isArray(parsedResponse.retrieved_federated_posts) ||
        !Array.isArray(parsedResponse.retrieved_bluesky_posts)) {
        console.error("OpenAI response did not match the expected JSON structure:", parsedResponse);
        throw new Error("OpenAI response did not match the expected JSON structure.");
    }
    
    return parsedResponse;

  } catch (error) {
    console.error('Error processing with OpenAI:', error.response ? error.response.data : error.message);
    return {
        ai_summary: "An error occurred while generating the AI summary. Please try again.",
        retrieved_actor_movie_info: actorMovieResults,
        retrieved_users: userResults,
        retrieved_federated_posts: federatedPostResults,
        retrieved_bluesky_posts: blueskyPostResults,
        error: "OpenAI processing failed."
    };
  }
}



// POST /api/chatbot/search 
router.post('/search', async (req, res) => {
  try {
    const { query } = req.body;
    const requestingUserId = req.session.user.userId;

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({ error: 'A non-empty search query string is required' });
    }
    console.log(`User ${requestingUserId} initiated RAG search: query='${query}'`);

    // concurrently search all dbs
    const [
        actorMovieResults,
        userResults,
        federatedPostResults,
        blueskyPostResults
    ] = await Promise.all([
        searchActorsMoviesChroma(query),
        searchUsersSql(query, requestingUserId),
        searchFederatedPostsSql(query),
        searchBlueskyPostsSql(query)
    ]);

    const result = await generateAiResponse(
        query,
        actorMovieResults,
        userResults,
        federatedPostResults,
        blueskyPostResults
    );

    res.json(result);

  } catch (error) {
    console.error(`Error in /api/chatbot/search route for user ${req.session?.user?.userId}:`, error);
    res.status(500).json({ error: 'An error occurred while processing your search request.' });
  }
});

// POST /api/chatbot/sync
router.post('/sync', isAuthenticated, async (req, res) => {
  const requestingUserId = req.session.user.userId;
  console.log(`User ${requestingUserId} initiated /sync.`);
  try {
    console.log("ChromaDB sync endpoint called. Actor/movie data is managed externally. Platform data sync (if any) is not implemented in this version of the endpoint.");
    res.json({
        success: true,
        message: 'Sync endpoint acknowledged. Actor/movie vector database is managed externally. No platform data sync performed by this endpoint in the current RAG setup.'
    });

  } catch (error) {
    console.error(`Error in /api/chatbot/sync route initiated by user ${requestingUserId}:`, error);
    res.status(500).json({ error: 'An error occurred during the sync operation.' });
  }
});

module.exports = router;