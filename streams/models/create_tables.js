import { get_db_connection, RelationalDB } from '../models/rdbms.js';

// Database connection setup
const dbaccess = get_db_connection();

function sendQueryOrCommand(db, query, params = []) {
    return new Promise((resolve, reject) => {
      db.query(query, params, (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
  }

async function create_tables() {

  /**
   * These should exist from HW2 and 3
   */

  // Note here that birth/death year should really be int but have often been put as string
  await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS names ( \
    nconst VARCHAR(255) UNIQUE, \
    primaryName VARCHAR(255), \
    birthYear VARCHAR(4), \
    deathYear VARCHAR(4), \
    nconst VARCHAR(255) PRIMARY KEY \
    );')

  await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS recommendations ( \
      person VARCHAR(255), \
      recommendation VARCHAR(255), \
      strength int, \
      FOREIGN KEY (person) REFERENCES names(nconst), \
      FOREIGN KEY (recommendation) REFERENCES names(nconst) \
      );')
  
    /**
     * This should also exist from HW3
     */
  await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS friends ( \
    followed VARCHAR(255), \
    follower VARCHAR(255), \
    FOREIGN KEY (follower) REFERENCES names(nconst), \
    FOREIGN KEY (followed) REFERENCES names(nconst) \
    );')

    // Create users table
    await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS users ( \
    user_id INT NOT NULL AUTO_INCREMENT, \
    username VARCHAR(255), \
    email VARCHAR(255) NOT NULL, \
    affiliation VARCHAR(255), \
    hashed_password VARCHAR(255), \
    linked_nconst VARCHAR(255), \
    PRIMARY KEY (user_id), \
    UNIQUE KEY unique_email (email), \
    FOREIGN KEY (linked_nconst) REFERENCES names(nconst) \
    );')

    // Create posts table
    await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS posts ( \
    post_id INT NOT NULL AUTO_INCREMENT, \
    parent_post INT, \
    title VARCHAR(255), \
    content VARCHAR(255), \
    author_id INT, \
    PRIMARY KEY (post_id), \
    FOREIGN KEY (parent_post) REFERENCES posts(post_id), \
    FOREIGN KEY (author_id) REFERENCES users(user_id) \
    );')

    // Create federated_posts table
    await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS federated_posts ( \
    post_id INT NOT NULL AUTO_INCREMENT, \
    username VARCHAR(255) NOT NULL, \
    source_site VARCHAR(255) NOT NULL, \
    post_uuid_within_site VARCHAR(255) NOT NULL, \
    post_text TEXT, \
    content_type VARCHAR(255), \
    attach_url VARCHAR(2083), \
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, \
    PRIMARY KEY (post_id), \
    UNIQUE KEY unique_post (source_site, post_uuid_within_site) \
    );')

    await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS like_posts ( \
    like_id INT NOT NULL AUTO_INCREMENT, \
    user_id INT NOT NULL, \
    post_id INT NOT NULL, \
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, \
    PRIMARY KEY (like_id), \
    UNIQUE KEY unique_like (user_id, post_id), \
    FOREIGN KEY (user_id) REFERENCES users(user_id), \
    FOREIGN KEY (post_id) REFERENCES posts(post_id) \
    );')

    
    await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS Bluesky_authors ( \
    did VARCHAR(100) NOT NULL, \
    handle VARCHAR(255), \
    display_name VARCHAR(255), \
    avatar_url TEXT, \
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, \
    PRIMARY KEY (did) \
    );')

    await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS Bluesky_posts ( \
    uri VARCHAR(255) PRIMARY KEY, \
    author_did VARCHAR(100), \
    text TEXT, \
    created_at TIMESTAMP, \
    reply_count INT DEFAULT 0, \
    repost_count INT DEFAULT 0, \
    like_count INT DEFAULT 0, \
    reply_to_uri VARCHAR(255) DEFAULT NULL, \
    embded_image_json TEXT DEFAULT NULL, \
    FOREIGN KEY (author_did) REFERENCES Bluesky_authors(did) \
    );')


    //ignore viewer data for now

    return null;
}

console.log('Creating tables');

async function create_populate() {
  await dbaccess.connect();
  await create_tables();
  console.log('Tables created');
}

create_populate().then(() => {
  console.log('Done');
  dbaccess.close();
}).catch((err) => {
  console.error(err);
  dbaccess.close();
}
).finally(() => {
  process.exit(0);
});

