require('dotenv').config();
const chromaDBManager = require('../utils/chromadb');

async function initializeTestData() {
  try {
    console.log('Initializing ChromaDB with test data...');

    // init chromadb
    await chromaDBManager.initialize();
    console.log('ChromaDB initialized successfully');

    // test people
    const testPeople = [
      {
        id: 'nm0000001',
        username: 'test_user1',
        first_name: 'John',
        last_name: 'Doe',
        profile_photo_url: 'test_photo1.jpg',
        affiliated_actor: 'Test Actor 1'
      },
      {
        id: 'nm0000002',
        username: 'test_user2',
        first_name: 'Jane',
        last_name: 'Smith',
        profile_photo_url: 'test_photo2.jpg',
        affiliated_actor: 'Test Actor 2'
      }
    ];

    //test posts
    const testPosts = [
      {
        id: 'tt0000001',
        user_id: 1,
        username: 'test_user1',
        content: 'This is a test post about movies',
        image_url: 'test_image1.jpg',
        created_at: '2023-01-01'
      },
      {
        id: 'tt0000002',
        user_id: 2,
        username: 'test_user2',
        content: 'Another test post about actors',
        image_url: 'test_image2.jpg',
        created_at: '2023-01-02'
      }
    ];

    // add test ppl
    console.log('Adding test people...');
    for (const person of testPeople) {
      await chromaDBManager.addPerson(person);
    }

    //add test psts
    console.log('Adding test posts...');
    for (const post of testPosts) {
      await chromaDBManager.addPost(post);
    }

    console.log('Verifying test data...');
    const peopleResults = await chromaDBManager.searchPeople('test');
    const postsResults = await chromaDBManager.searchPosts('test');

    console.log('Test people found:', peopleResults.length);
    console.log('Test posts found:', postsResults.length);

    console.log('ChromaDB test initialization completed successfully!');
  } catch (error) {
    console.error('Error initializing test data:', error);
    process.exit(1);
  }
}

initializeTestData(); 