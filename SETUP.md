# InstaLite - Chatbot Setup Guide

This document explains how to set up and run the chatbot feature for the InstaLite project.

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- MySQL or RDS database
- OpenAI API key

## Environment Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd project-instalite-2y2b
   ```

2. Set up the backend:
   ```bash
   cd backend
   npm install
   ```

3. Configure the environment variables:
   Create a `.env` file in the `backend` directory with the following content (replace with your actual values):
   ```
   PORT=5000
   DB_HOST=your-db-host
   DB_USER=your-db-user
   DB_PASSWORD=your-db-password
   DB_NAME=imdb_basic
   OPENAI_API_KEY=your-openai-api-key
   ```

4. Set up the frontend:
   ```bash
   cd ../frontend
   npm install
   ```

## Database Setup

1. Create the necessary database tables:
   ```sql
   CREATE DATABASE IF NOT EXISTS instalite;
   USE instalite;

   CREATE TABLE IF NOT EXISTS users (
     id INT AUTO_INCREMENT PRIMARY KEY,
     username VARCHAR(50) NOT NULL UNIQUE,
     password VARCHAR(255) NOT NULL,
     first_name VARCHAR(50) NOT NULL,
     last_name VARCHAR(50) NOT NULL,
     email VARCHAR(100) NOT NULL UNIQUE,
     affiliation VARCHAR(100),
     birthday DATE,
     profile_photo_url VARCHAR(255),
     affiliated_actor VARCHAR(100),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   CREATE TABLE IF NOT EXISTS posts (
     id INT AUTO_INCREMENT PRIMARY KEY,
     user_id INT NOT NULL,
     content TEXT,
     image_url VARCHAR(255),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (user_id) REFERENCES users(id)
   );

   CREATE TABLE IF NOT EXISTS hashtags (
     id INT AUTO_INCREMENT PRIMARY KEY,
     name VARCHAR(50) NOT NULL UNIQUE
   );

   CREATE TABLE IF NOT EXISTS post_hashtags (
     post_id INT NOT NULL,
     hashtag_id INT NOT NULL,
     PRIMARY KEY (post_id, hashtag_id),
     FOREIGN KEY (post_id) REFERENCES posts(id),
     FOREIGN KEY (hashtag_id) REFERENCES hashtags(id)
   );

   CREATE TABLE IF NOT EXISTS user_interests (
     user_id INT NOT NULL,
     hashtag_id INT NOT NULL,
     PRIMARY KEY (user_id, hashtag_id),
     FOREIGN KEY (user_id) REFERENCES users(id),
     FOREIGN KEY (hashtag_id) REFERENCES hashtags(id)
   );
   ```

2. Seed the database with sample data (optional for testing):
   ```sql
   -- Sample users
   INSERT INTO users (username, password, first_name, last_name, email, affiliation, affiliated_actor)
   VALUES 
     ('john_doe', '$2b$10$random_hash', 'John', 'Doe', 'john@example.com', 'Penn', 'Tom Hanks'),
     ('jane_smith', '$2b$10$random_hash', 'Jane', 'Smith', 'jane@example.com', 'Penn', 'Jennifer Lawrence');

   -- Sample hashtags
   INSERT INTO hashtags (name) VALUES ('travel'), ('food'), ('movies'), ('tech'), ('music');

   -- Sample posts
   INSERT INTO posts (user_id, content) 
   VALUES 
     (1, 'Just watched a great movie! #movies'),
     (2, 'Trying out this new recipe #food'),
     (1, 'Working on a new tech project #tech'),
     (2, 'Listening to my favorite album #music');

   -- Link posts to hashtags
   INSERT INTO post_hashtags (post_id, hashtag_id) VALUES (1, 3), (2, 2), (3, 4), (4, 5);

   -- User interests
   INSERT INTO user_interests (user_id, hashtag_id) VALUES (1, 3), (1, 4), (2, 2), (2, 5);
   ```

## Running the Application

1. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Start the frontend development server:
   ```bash
   cd ../frontend
   npm start
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000/search
   ```

## ChromaDB Setup

The chatbot uses ChromaDB for vector similarity search. To initialize the vector database with your data, make a POST request to the sync endpoint:

```bash
curl -X POST http://localhost:5000/api/chatbot/sync
```

This will populate ChromaDB with data from your MySQL database.

## Notes on OpenAI Integration

The chatbot uses OpenAI's API for generating responses. The API key is set in the `.env` file. The implementation uses retrieval-augmented generation to:

1. Search for relevant people and posts in the database using both SQL and vector similarity
2. Pass the search results to OpenAI's API to generate a natural language response
3. Return both the AI-generated response and the structured search results to the frontend

The chatbot supports searching for:
- People (by username, first name, or last name)
- Posts (by content or hashtags)

Results include links to view profiles, add friends, view posts, and follow hashtags. 