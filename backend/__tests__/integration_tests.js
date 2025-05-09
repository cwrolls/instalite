const request = require('supertest');
const app = require('../server');
const db = require('../db');

const loginUser = async (credentials) => {
  const agent = request.agent(app);
  const response = await agent
    .post('/api/auth/login')
    .send(credentials)
    .expect(200); 
  return agent;
};

const testUser1Credentials = { username: 'testuser1', password: 'password123', email: 'test1@example.com', firstName: 'Test', lastName: 'UserOne' };
const testUser2Credentials = { username: 'testuser2', password: 'password123', email: 'test2@example.com', firstName: 'Test', lastName: 'UserTwo' };
const testUser3Credentials = { username: 'testuser3', password: 'password123', email: 'test3@example.com', firstName: 'Test', lastName: 'UserThree' };

let user1Agent, user2Agent, user3Agent;
let user1Id, user2Id, user3Id;

describe('Social Media Platform Integration Tests', () => {
  beforeAll(async () => {
    try {
      await db.query('DELETE FROM bookmarks');
      await db.query('DELETE FROM friendships');
      await db.query('DELETE FROM federated_posts');

      let [rows1] = await db.query('SELECT user_id FROM users WHERE username = ?', [testUser1Credentials.username]);
      if (!rows1 || rows1.length === 0) throw new Error(`Test user ${testUser1Credentials.username} not found. Seed database or adjust user creation.`);
      user1Id = rows1[0].user_id;

      let [rows2] = await db.query('SELECT user_id FROM users WHERE username = ?', [testUser2Credentials.username]);
      if (!rows2 || rows2.length === 0) throw new Error(`Test user ${testUser2Credentials.username} not found. Seed database or adjust user creation.`);
      user2Id = rows2[0].user_id;

      let [rows3] = await db.query('SELECT user_id FROM users WHERE username = ?', [testUser3Credentials.username]);
      if (!rows3 || rows3.length === 0) throw new Error(`Test user ${testUser3Credentials.username} not found. Seed database or adjust user creation.`);
      user3Id = rows3[0].user_id;

    } catch (dbError) {
      console.error("Database setup error in beforeAll:", dbError);
      throw dbError; 
    }

    user1Agent = await loginUser(testUser1Credentials);
    user2Agent = await loginUser(testUser2Credentials);
    user3Agent = await loginUser(testUser3Credentials);
  });

  afterAll(async () => {
    if (db.pool && typeof db.pool.end === 'function') {
        await db.pool.end();
    } else if (db.end && typeof db.end === 'function') {
        await db.end();
    }
  });


  describe('Friendship Management (/api/friendships)', () => {
    let friendshipId_1_to_2;

    test('User1 sends friend request to User2', async () => {
      const res = await user1Agent
        .post('/api/friendships/request')
        .send({ recipientId: user2Id })
        .expect(201);
      expect(res.body.message).toBe('Friend request sent successfully.');
      expect(res.body.friendship).toBeDefined();
      expect(res.body.friendship.status).toBe('pending');
      expect(res.body.friendship.user1_id).toBe(Math.min(user1Id, user2Id));
      expect(res.body.friendship.user2_id).toBe(Math.max(user1Id, user2Id));
      expect(res.body.friendship.action_user_id).toBe(user1Id);
    });

    test('User2 views incoming friend request from User1', async () => {
      const res = await user2Agent
        .get('/api/friendships/pending/incoming')
        .expect(200);
      const request = res.body.pendingRequests.find(r => r.sender.userId === user1Id);
      expect(request).toBeDefined();
      friendshipId_1_to_2 = request.friendshipId;
    });

    test('User2 accepts friend request from User1', async () => {
      expect(friendshipId_1_to_2).toBeDefined();
      const res = await user2Agent
        .post('/api/friendships/accept')
        .send({ friendshipId: friendshipId_1_to_2 })
        .expect(200);
      expect(res.body.message).toBe('Friend request accepted.');
      expect(res.body.friendship.status).toBe('accepted');
      expect(res.body.friendship.action_user_id).toBe(user2Id);
    });

    test('User1 checks friendship status with User2 (should be accepted)', async () => {
      const res = await user1Agent
        .get('/api/friendships/status/' + user2Id)
        .expect(200);
      expect(res.body.friendship).toBeDefined();
      expect(res.body.friendship.status).toBe('accepted');
    });

    test('User1 lists User2 as a friend', async () => {
      const res = await user1Agent.get('/api/friendships/').expect(200);
      const friend = res.body.friends.find(f => f.user_id === user2Id);
      expect(friend).toBeDefined();
      expect(friend.username).toBe(testUser2Credentials.username);
    });

    test('User1 unfriends User2', async () => {
      const res = await user1Agent
        .delete('/api/friendships/' + user2Id)
        .expect(200);
      expect(res.body.message).toBe('Friend removed successfully.');
    });

    test('User1 checks friendship status with User2 (should be null)', async () => {
      const res = await user1Agent
        .get('/api/friendships/status/' + user2Id)
        .expect(200);
      expect(res.body.friendship).toBeNull();
    });
  });


  describe('Federated Post Creation & Bookmarking (/api/posts/federated, /api/bookmarks)', () => {
    let testFederatedPostId;

    test('User1 creates a federated post', async () => {
      const postPayload = {
        post_json: {
          username: testUser1Credentials.username,
          source_site: "testsuite-site",
          post_uuid_within_site: 'test-post-' + Date.now(),
          post_text: "A fascinating federated post from User1 for testing bookmarks.",
          content_type: "text/plain",
          hashtags: ["integration", "testing"]
        },
        attach: "https://example.com/image.png"
      };
      const res = await user1Agent 
        .post('/api/posts/federated')
        .send(postPayload)
        .expect(201);
      
      expect(res.body.message).toBe('Federated post received!');
      expect(res.body.federatedPost).toBeDefined();

      testFederatedPostId = res.body.federatedPost.id || res.body.federatedPost.post_id; 
      if(!testFederatedPostId) {
        const [rows] = await db.query("SELECT post_id FROM federated_posts WHERE username = ? ORDER BY created_at DESC LIMIT 1", [testUser1Credentials.username]);
        if (rows && rows.length > 0) testFederatedPostId = rows[0].post_id;
      }
      expect(testFederatedPostId).toBeDefined();
    });

    test('User2 bookmarks User1s federated post', async () => {
      expect(testFederatedPostId).toBeDefined();
      const res = await user2Agent
        .post('/api/bookmarks/' + testFederatedPostId)
        .expect(201);
      expect(res.body.message).toBe('Post bookmarked successfully.');
      expect(res.body.postId).toBe(testFederatedPostId);
    });

    test('User2 attempts to bookmark the same post again (should conflict)', async () => {
      await user2Agent
        .post('/api/bookmarks/' + testFederatedPostId)
        .expect(409);
    });

    test('User2 views their bookmarked post IDs (should include the new bookmark)', async () => {
      const res = await user2Agent.get('/api/bookmarks/ids').expect(200);
      expect(res.body.bookmarkedPostIds).toContain(testFederatedPostId);
    });
    
    test('User2 views their bookmarked posts on their profile (should include the new bookmark details)', async () => {
        const res = await user2Agent.get('/api/bookmarks/user/' + testUser2Credentials.username).expect(200);
        const bookmarkedPost = res.body.bookmarkedPosts.find(p => p.post_id === testFederatedPostId);
        expect(bookmarkedPost).toBeDefined();
        expect(bookmarkedPost.post_text).toContain("A fascinating federated post");
        expect(bookmarkedPost.author.username).toBe(testUser1Credentials.username);
        expect(bookmarkedPost.image_url).toBe("https://example.com/image.png");
    });

    test('User2 unbookmarks the post', async () => {
      const res = await user2Agent
        .delete('/api/bookmarks/' + testFederatedPostId)
        .expect(200);
      expect(res.body.message).toBe('Bookmark removed successfully.');
    });

    test('User2 views their bookmarked post IDs (should NOT include the removed bookmark)', async () => {
      const res = await user2Agent.get('/api/bookmarks/ids').expect(200);
      expect(res.body.bookmarkedPostIds).not.toContain(testFederatedPostId);
    });
  });

  describe('Friend Recommendations (/api/friendships/recommendations)', () => {

    beforeAll(async () => {
        // clear prev freidn relationships
        await db.query('DELETE FROM friendships');
        await db.query('DELETE FROM bookmarks');

        const req1_2 = await user1Agent.post('/api/friendships/request').send({ recipientId: user2Id }).expect(201);
        await user2Agent.post('/api/friendships/accept').send({ friendshipId: req1_2.body.friendship.friendship_id }).expect(200);

        const req2_3 = await user2Agent.post('/api/friendships/request').send({ recipientId: user3Id }).expect(201);
        await user3Agent.post('/api/friendships/accept').send({ friendshipId: req2_3.body.friendship.friendship_id }).expect(200);
    });

    test('User1 should get User3 as a recommendation (friend of friend)', async () => {
        const res = await user1Agent.get('/api/friendships/recommendations').expect(200);
        const recommendations = res.body.recommendations;
        expect(recommendations.some(r => r.user_id === user3Id && r.username === testUser3Credentials.username)).toBe(true);
        expect(recommendations.some(r => r.user_id === user1Id)).toBe(false);
        expect(recommendations.some(r => r.user_id === user2Id)).toBe(false);
    });
    
    test('User3 should get User1 as a recommendation (friend of friend)', async () => {
        const res = await user3Agent.get('/api/friendships/recommendations').expect(200);
        const recommendations = res.body.recommendations;
        expect(recommendations.some(r => r.user_id === user1Id && r.username === testUser1Credentials.username)).toBe(true);
        expect(recommendations.some(r => r.user_id === user3Id)).toBe(false);
        expect(recommendations.some(r => r.user_id === user2Id)).toBe(false);
    });

    test('User2 should not get User1 or User3 as recommendations (already friends)', async () => {
        const res = await user2Agent.get('/api/friendships/recommendations').expect(200);
        const recommendations = res.body.recommendations;
        expect(recommendations.some(r => r.user_id === user1Id)).toBe(false);
        expect(recommendations.some(r => r.user_id === user3Id)).toBe(false);
    });
  });
});
