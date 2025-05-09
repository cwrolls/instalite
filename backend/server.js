import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path, { dirname } from 'path';
import fs from 'fs';
import http from 'http';
import MySQLStoreFactory from 'express-mysql-session';
const MySQLStore = MySQLStoreFactory(session);
import { Server as SocketIOServer } from 'socket.io';
import db from './db.js';
import imageUploadRoutes from './routes/imageUpload.js';
import userRoutes from './routes/users.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import friendshipRoutes from './routes/friendships.js';
import chatbotRoutes from './routes/chatbot.js';
import chatbotV2Routes from './routes/chatbot_v2.js';
import hashtagsRoutes from './routes/hashtags.js';
import feedRoutes from './routes/feed.js';
import federatedPostsRouter from './routes/posts.js';
import postinfoRoutes from './routes/postinfo.js';
import { isAuthenticated } from './routes/middleware/authMiddleware.js';
import bookmarksRouter from './routes/bookmarks.js';

import { } from './routes/middleware/authMiddleware.js';

import { initializeSocketIO as initializeChatService, fetchUserDetails as chatFetchUserDetails, onlineUsers as chatSpecificOnlineUsers } from './routes/chat-socket.js';
import { initializePresenceService, getGlobalOnlineUsers, sendToastToUser as sendGlobalToast } from './services/presenceService.js';


const PORT = process.env.PORT || 8080;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const SESSION_SECRET = process.env.SESSION_SECRET || 'nets2120-instalite-secret';

const app = express();

const sessionStoreOptions = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    clearExpired: true,
    checkExpirationInterval: 900000,
    expiration: 86400000,
    createDatabaseTable: true,
    schema: {
        tableName: 'sessions',
        columnNames: {
            session_id: 'session_id',
            expires: 'expires',
            data: 'data'
        }
    }
};
const sessionStore = new MySQLStore(sessionStoreOptions, db);

// middleware
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionMiddleware = session({
    secret: SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax' 
    }
});
app.use(sessionMiddleware);

const actorImagesPath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'Indexing', 'images');
console.log(`Configuring static file serving for actor images from: ${actorImagesPath}`);
if (!fs.existsSync(actorImagesPath)) {
     console.warn(`!!! Warning: Actor images directory not found at specified path. Images at /actor-images/ will result in 404.`);
} else {
    console.log(`   Directory found. Serving under URL path '/actor-images'.`);
}
app.use('/actor-images', express.static(actorImagesPath));

console.log('Registering API routes...');
app.use('/api/auth', authRoutes);
app.use('/api/images', imageUploadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/friendships', friendshipRoutes);
// app.use('/api/chatbot', chatbotRoutes);
app.use('/api/chatbot', chatbotV2Routes);
app.use('/api/hashtags', hashtagsRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/posts', federatedPostsRouter);
app.use('/api/bookmarks', bookmarksRouter);
app.use('/api/postinfo', postinfoRoutes);

app.get('/api', (req, res) => {
  res.json({ message: 'Welcome to the InstaLite API!' });
});

const presenceRouter = express.Router();
presenceRouter.get('/online-users', isAuthenticated, (req, res) => {
    const onlineUsersList = getGlobalOnlineUsers(); 
    const onlineUserIds = onlineUsersList.map(u => u.userId);
    res.json({ onlineUserIds });
});
app.use('/api/presence', presenceRouter);

app.post('/api/dev/toast/:userId', isAuthenticated, (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Not authenticated"});
    
    const { userId } = req.params;
    const { title, content, type, viewLink, viewText, duration } = req.body;
    
    if (!userId || !content || !type) {
        return res.status(400).json({ error: 'Target userId, content, and type are required for toast.' });
    }
    const toastData = { title, content, type, viewLink, viewText, duration };
    const success = sendGlobalToast(userId, toastData);
    
    if (success) {
        res.json({ message: `Toast dispatch initiated for user ${userId}` });
    } else {
        res.status(500).json({ error: `Failed to dispatch toast or user ${userId} not online.` });
    }
});

app.get('/api/dev/online-users', isAuthenticated, (req, res) => {
    res.json({ onlineUsers: getGlobalOnlineUsers() });
});


app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.stack || err);
  const statusCode = err.status || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal Server Error' : (err.message || 'Something broke!');
  res.status(statusCode).json({ error: message });
});

const server = http.createServer(app);

const io = new SocketIOServer(server, {
    cors: {
        origin: FRONTEND_URL,
        methods: ["GET", "POST"],
        credentials: true
    },
});

const chatIoNamespace = initializeChatService(io, sessionMiddleware); 


initializePresenceService(io, sessionMiddleware);

app.set('chatIoNamespace', chatIoNamespace); 
app.set('chatSpecificOnlineUsers', chatSpecificOnlineUsers); 
app.set('chatFetchUserDetails', chatFetchUserDetails); 

app.set('mainSocketIo', io); 
app.set('getGlobalOnlineUsers', getGlobalOnlineUsers); 
app.set('sendGlobalToast', sendGlobalToast);

// start server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Accepting connections from frontend at: ${FRONTEND_URL}`);
    console.log(`Database Host: ${process.env.DB_HOST || 'localhost'}`);
});