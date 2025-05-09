const { ChromaClient, OpenAIEmbeddingFunction } = require('chromadb');

class ChromaDBManager {
  constructor() {
    this.client = new ChromaClient({
      path: "http://localhost:8000"
    });
    this.embeddingFunction = new OpenAIEmbeddingFunction({
      openai_api_key: process.env.OPENAI_API_KEY,
      model_name: "text-embedding-ada-002"
    });
    this.collections = {
      people: null,
      posts: null
    };
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Create or get the collections
      this.collections.people = await this.client.getOrCreateCollection({
        name: "people",
        embeddingFunction: this.embeddingFunction
      });

      this.collections.posts = await this.client.getOrCreateCollection({
        name: "posts",
        embeddingFunction: this.embeddingFunction
      });

      this.initialized = true;
      console.log("ChromaDB initialized successfully");
    } catch (error) {
      console.error("Error initializing ChromaDB:", error);
      throw error;
    }
  }

  // add person to chroma
  async addPerson(person) {
    await this.initialize();
    try {
      const document = `${person.username} ${person.first_name} ${person.last_name}`;
      const metadata = {
        id: person.id.toString(),
        username: person.username,
        first_name: person.first_name,
        last_name: person.last_name,
        profile_photo_url: person.profile_photo_url || '',
        affiliated_actor: person.affiliated_actor || ''
      };

      await this.collections.people.add({
        ids: [person.id.toString()],
        documents: [document],
        metadatas: [metadata]
      });

      return true;
    } catch (error) {
      console.error("Error adding person to ChromaDB:", error);
      throw error;
    }
  }

  // add post
  async addPost(post) {
    await this.initialize();
    try {
      const document = post.content;
      const metadata = {
        id: post.id.toString(),
        user_id: post.user_id.toString(),
        username: post.username,
        content: post.content,
        image_url: post.image_url || '',
        created_at: post.created_at
      };

      await this.collections.posts.add({
        ids: [post.id.toString()],
        documents: [document],
        metadatas: [metadata]
      });

      return true;
    } catch (error) {
      console.error("Error adding post to ChromaDB:", error);
      throw error;
    }
  }

  // search for ppl
  async searchPeople(query, limit = 5) {
    await this.initialize();
    try {
      const results = await this.collections.people.query({
        queryTexts: [query],
        nResults: limit
      });

      return results.metadatas[0].map(metadata => ({
        id: parseInt(metadata.id),
        username: metadata.username,
        first_name: metadata.first_name,
        last_name: metadata.last_name,
        profile_photo_url: metadata.profile_photo_url,
        affiliated_actor: metadata.affiliated_actor
      }));
    } catch (error) {
      console.error("Error searching people in ChromaDB:", error);
      throw error;
    }
  }

  // search for posts in chroma
  async searchPosts(query, limit = 5) {
    await this.initialize();
    try {
      const results = await this.collections.posts.query({
        queryTexts: [query],
        nResults: limit
      });

      return results.metadatas[0].map(metadata => ({
        id: parseInt(metadata.id),
        user_id: parseInt(metadata.user_id),
        username: metadata.username,
        content: metadata.content,
        image_url: metadata.image_url,
        created_at: metadata.created_at
      }));
    } catch (error) {
      console.error("Error searching posts in ChromaDB:", error);
      throw error;
    }
  }
}

const chromaDBManager = new ChromaDBManager();
module.exports = chromaDBManager; 