const sinon = require('sinon');
const { OpenAI } = require('openai');
const mysql = require('mysql2/promise');
const express = require('express');
const request = require('supertest');
const router = require('../routes/chatbot');

// Mock OpenAI
jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }))
  };
});

// Mock mysql2
jest.mock('mysql2/promise', () => ({
  createConnection: jest.fn()
}));

// Mock ChromaDB
jest.mock('../utils/chromadb', () => ({
  addPerson: jest.fn().mockResolvedValue(true),
  addPost: jest.fn().mockResolvedValue(true),
  searchPeople: jest.fn().mockResolvedValue([]),
  searchPosts: jest.fn().mockResolvedValue([]),
  initialize: jest.fn().mockResolvedValue(true)
}));

describe('Chatbot API Tests', () => {
  let app;
  let mockDB;
  let mockOpenAI;

  beforeEach(() => {
    // Setup Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/chatbot', router);

    // Reset all mocks
    jest.clearAllMocks();

    // Mock DB connection
    mockDB = {
      execute: jest.fn(),
      end: jest.fn()
    };
    mysql.createConnection.mockImplementation(() => Promise.resolve(mockDB));

    // Initialize OpenAI mock
    mockOpenAI = new OpenAI();
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'AI response' } }]
    });
  });

  describe('POST /search - Search Functionality', () => {
    test('should handle valid search query for both people and posts', async () => {
      const mockPeople = [
        { 
          id: 'nm0000001', 
          username: 'user1',
          first_name: 'John',
          last_name: 'Doe',
          profile_photo_url: 'photo1.jpg',
          affiliated_actor: 'Actor1'
        }
      ];

      const mockPosts = [
        {
          id: 'tt0000001',
          user_id: 1,
          content: 'Test post',
          image_url: 'image1.jpg',
          created_at: '2023',
          username: 'IMDB'
        }
      ];

      // Mock database responses
      mockDB.execute
        .mockImplementationOnce(() => Promise.resolve([mockPeople]))
        .mockImplementationOnce(() => Promise.resolve([mockPosts]));

      const response = await request(app)
        .post('/api/chatbot/search')
        .send({ query: 'test query' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('aiResponse');
      expect(response.body).toHaveProperty('searchResults');
      expect(response.body.searchResults).toHaveProperty('people');
      expect(response.body.searchResults).toHaveProperty('posts');
    });

    test('should handle empty search results', async () => {
      // Mock empty database responses
      mockDB.execute
        .mockImplementationOnce(() => Promise.resolve([[]]))
        .mockImplementationOnce(() => Promise.resolve([[]]));

      const response = await request(app)
        .post('/api/chatbot/search')
        .send({ query: 'nonexistent' });

      expect(response.status).toBe(200);
      expect(response.body.searchResults.people).toHaveLength(0);
      expect(response.body.searchResults.posts).toHaveLength(0);
    });

    test('should handle type-specific searches - people only', async () => {
      const mockPeople = [{ id: 'nm0000001' }];
      mockDB.execute.mockImplementationOnce(() => Promise.resolve([mockPeople]));

      const response = await request(app)
        .post('/api/chatbot/search')
        .send({ query: 'test', type: 'people' });

      expect(response.status).toBe(200);
      expect(response.body.searchResults).toHaveProperty('people');
      expect(mockDB.execute).toHaveBeenCalledTimes(1);
    });

    test('should handle type-specific searches - posts only', async () => {
      const mockPosts = [{ id: 'tt0000001' }];
      mockDB.execute.mockImplementationOnce(() => Promise.resolve([mockPosts]));

      const response = await request(app)
        .post('/api/chatbot/search')
        .send({ query: 'test', type: 'posts' });

      expect(response.status).toBe(200);
      expect(response.body.searchResults).toHaveProperty('posts');
      expect(mockDB.execute).toHaveBeenCalledTimes(1);
    });

    test('should reject empty queries', async () => {
      const response = await request(app)
        .post('/api/chatbot/search')
        .send({ query: '' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle database connection errors', async () => {
      mysql.createConnection.mockRejectedValue(new Error('DB Connection Failed'));

      const response = await request(app)
        .post('/api/chatbot/search')
        .send({ query: 'test' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle OpenAI API errors', async () => {
      mockDB.execute
        .mockImplementationOnce(() => Promise.resolve([[]]))
        .mockImplementationOnce(() => Promise.resolve([[]]));

      // Mock OpenAI to throw an error
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error('OpenAI API Error'));

      const response = await request(app)
        .post('/api/chatbot/search')
        .send({ query: 'test' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle extremely long queries', async () => {
      const longQuery = 'a'.repeat(1000);
      
      mockDB.execute
        .mockImplementationOnce(() => Promise.resolve([[]]))
        .mockImplementationOnce(() => Promise.resolve([[]]));

      const response = await request(app)
        .post('/api/chatbot/search')
        .send({ query: longQuery });

      expect(response.status).toBe(200);
    });

    test('should handle special characters in search query', async () => {
      const specialQuery = '!@#$%^&*()_+';
      
      mockDB.execute
        .mockImplementationOnce(() => Promise.resolve([[]]))
        .mockImplementationOnce(() => Promise.resolve([[]]));

      const response = await request(app)
        .post('/api/chatbot/search')
        .send({ query: specialQuery });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /sync - Database Sync Functionality', () => {
    test('should successfully sync database with vector database', async () => {
      const mockUsers = [{ id: 1, username: 'user1' }];
      const mockPosts = [{ id: 1, content: 'post1', user_id: 1 }];

      mockDB.execute
        .mockImplementationOnce(() => Promise.resolve([mockUsers]))
        .mockImplementationOnce(() => Promise.resolve([mockPosts]));

      const response = await request(app)
        .post('/api/chatbot/sync');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    test('should handle empty database during sync', async () => {
      mockDB.execute
        .mockImplementationOnce(() => Promise.resolve([[]]))
        .mockImplementationOnce(() => Promise.resolve([[]]));

      const response = await request(app)
        .post('/api/chatbot/sync');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    test('should handle database errors during sync', async () => {
      mockDB.execute.mockRejectedValue(new Error('DB Error'));

      const response = await request(app)
        .post('/api/chatbot/sync');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle ChromaDB errors during sync', async () => {
      const mockUsers = [{ id: 1, username: 'user1' }];
      mockDB.execute.mockImplementationOnce(() => Promise.resolve([mockUsers]));

      // Mock ChromaDB to throw an error
      const chromaError = new Error('ChromaDB Error');
      const chromaDBMock = require('../utils/chromadb');
      chromaDBMock.addPerson.mockRejectedValueOnce(chromaError);

      const response = await request(app)
        .post('/api/chatbot/sync');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed JSON in request', async () => {
      const response = await request(app)
        .post('/api/chatbot/search')
        .send('malformed json{');

      expect(response.status).toBe(400);
    });

    test('should handle missing request body', async () => {
      const response = await request(app)
        .post('/api/chatbot/search')
        .send();

      expect(response.status).toBe(400);
    });

    test('should handle invalid search type', async () => {
      const response = await request(app)
        .post('/api/chatbot/search')
        .send({ query: 'test', type: 'invalid_type' });

      expect(response.status).toBe(200);
      expect(response.body.searchResults).toHaveProperty('people');
      expect(response.body.searchResults).toHaveProperty('posts');
    });

    test('should handle concurrent requests', async () => {
      // Mock database to handle multiple concurrent requests
      mockDB.execute.mockImplementation(() => Promise.resolve([[]]));

      const promises = Array(5).fill().map(() =>
        request(app)
          .post('/api/chatbot/search')
          .send({ query: 'test' })
      );

      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
}); 