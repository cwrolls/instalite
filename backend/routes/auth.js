const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const { v4: uuidv4 } = require('uuid'); 
const { isAuthenticated } = require('./middleware/authMiddleware');

const SALT_ROUNDS = 10; 

router.post('/signup', async (req, res) => {
    const {
    username,
    password,
    email,
    firstName,
    lastName,
    affiliation,
    birthday
    } = req.body;

    // input validation
    if (!username || !password || !email || !firstName || !lastName) {
        return res.status(400).json({ error: 'Missing required fields (username, password, email, firstName, lastName)' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }

    try {
        // check existing user
        const checkUserSql = 'SELECT user_id, username FROM users WHERE username = ? OR email = ?'; // Also select username for conflict message
        const [existingUsers] = await db.query(checkUserSql, [username, email]);

        if (existingUsers.length > 0) {
        const conflictField = existingUsers[0].username === username ? 'Username' : 'Email';
        console.log(`Signup failed: ${conflictField} already exists.`);
        return res.status(409).json({ error: `${conflictField} already exists.` }); // 409 Conflict
        }

        // hash pw
        console.log(`Hashing password for new user: ${username}`);
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        const passwordHash = await bcrypt.hash(password, salt);
        console.log(`Password hashed successfully.`);

        // insert new user
        const insertSql = `
        INSERT INTO users
            (username, password_hash, salt, first_name, last_name, email, affiliation, birthday)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const insertParams = [
        username,
        passwordHash,
        salt,
        firstName,
        lastName,
        email,
        affiliation || null,
        birthday || null
        ];

        const [insertResult] = await db.query(insertSql, insertParams);
        const newUserId = insertResult.insertId;

        console.log(`New user created successfully: username=${username}, userId=${newUserId}`);

        // log in after signup automatically
        const userSessionData = {
            userId: newUserId,
            username: username,
            firstName: firstName,
            lastName: lastName,
        };
        req.session.user = userSessionData; // save session
        console.log(`Session created for new user: ${username}`);

        res.status(201).json({
        message: 'User created successfully and logged in!',
        user: userSessionData
        });

    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({ error: 'An internal server error occurred during signup.' });
    }
});


// login route
// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    // find user
    const sql = `
      SELECT user_id, username, password_hash, salt, first_name, last_name, profile_photo_url
      FROM users
      WHERE username = ?
    `;
    const [rows] = await db.query(sql, [username]);

    if (rows.length === 0) {
      console.log(`Login attempt failed: User not found - ${username}`);
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = rows[0];
    const userSessionData = {
        userId: user.user_id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        profilePhotoUrl: user.profile_photo_url
    };

    // TEMP bypass for test
    if (user.username === 'alice' || user.username === 'bob' || user.username === 'charlie') {
        console.warn(`!!! WARNING: Bypassing password check for test user: ${user.username} !!!`);

        req.session.user = userSessionData;
        console.log(`Session created via BYPASS for user: ${username}`);

        return res.json({ 
            message: 'Login successful! (BYPASSED)',
            user: userSessionData
        });
    }
    // end

    console.log(`Comparing password for user: ${username}`);
    const match = await bcrypt.compare(password, user.password_hash);

    if (match) {
      // successful login so create session
      console.log(`Login successful for user: ${username}, userId: ${user.user_id}`);
      req.session.user = userSessionData;
      console.log(`Session created for user: ${username}`);

      res.json({
        message: 'Login successful!',
        user: userSessionData 
      });

    } else {
      console.log(`Login attempt failed: Invalid password for user - ${username}`);
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'An internal server error occurred during login.' });
  }
});


// logout route
router.post('/logout', (req, res, next) => {
    if (req.session) {
        console.log(`Logging out user: ${req.session.user?.username} (Session ID: ${req.session.id})`);
        req.session.destroy(err => {
            if (err) {
                console.error('Error destroying session:', err);
                return next(new Error('Could not log out, please try again.'));
            } else {
                res.clearCookie('instalte_session_id');
                console.log('Session destroyed and cookie cleared.');
                return res.status(200).json({ message: 'Logout successful' });
            }
        });
    } else {
        console.log('Logout attempt with no active session.');
        return res.status(200).json({ message: 'No active session found.' });
    }
});

// check session route
router.get('/session', isAuthenticated, (req, res) => {
    console.log(`Session check successful for user: ${req.session.user.username}`);
    res.status(200).json({
        message: "Session is active.",
        user: req.session.user
    });
});


module.exports = router;