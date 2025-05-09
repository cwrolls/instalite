import { Server } from 'socket.io';

const globalOnlineUsers = new Map();
let presenceIoNamespace = null; 


// init presence and global testing service
export function initializePresenceService(mainIoServer, sessionMiddleware) {
    const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
    
    presenceIoNamespace = mainIoServer.of('/presence');

    presenceIoNamespace.use(wrap(sessionMiddleware));

    presenceIoNamespace.on('connection', (socket) => {
        const session = socket.request.session;
        const user = session?.user;

        if (user && user.userId) {
            const userId = user.userId;
            const username = user.username;

            console.log(`[Presence Socket ${socket.id}] User ${username} (ID: ${userId}) connected to /presence.`);

            if (!globalOnlineUsers.has(userId)) {
                globalOnlineUsers.set(userId, {
                    socketIds: new Set([socket.id]),
                    connectionCount: 1,
                    userDetails: { 
                        userId: userId,
                        username: username,
                        profilePhotoUrl: user.profilePhotoUrl 
                    }
                });
                presenceIoNamespace.emit('globalUserOnline', globalOnlineUsers.get(userId).userDetails);
                console.log(`[Presence] User ${username} is now globally online. Total distinct online: ${globalOnlineUsers.size}`);
            } else {
                const userData = globalOnlineUsers.get(userId);
                userData.socketIds.add(socket.id);
                userData.connectionCount += 1;
                console.log(`[Presence] User ${username} opened another window/tab. Connection count: ${userData.connectionCount}`);
            }

            socket.on('disconnect', () => {
                console.log(`[Presence Socket ${socket.id}] User ${username} (ID: ${userId}) disconnected from /presence.`);
                if (globalOnlineUsers.has(userId)) {
                    const userData = globalOnlineUsers.get(userId);
                    userData.socketIds.delete(socket.id);
                    userData.connectionCount -= 1;

                    if (userData.connectionCount <= 0) {
                        globalOnlineUsers.delete(userId);
                        presenceIoNamespace.emit('globalUserOffline', { userId });
                        console.log(`[Presence] User ${username} is now globally offline. Total distinct online: ${globalOnlineUsers.size}`);
                    } else {
                        console.log(`[Presence] User ${username} closed a window/tab. Remaining connections: ${userData.connectionCount}`);
                    }
                }
            });

        } else {
            console.log(`[Presence Socket ${socket.id}] Unauthenticated user connected to /presence and will be disconnected.`);
            socket.disconnect(true); 
        }
    });
    console.log("Global Presence Service initialized on /presence namespace.");
}

// return currently globally online users
export function getGlobalOnlineUsers() {
    return Array.from(globalOnlineUsers.values()).map(data => data.userDetails);
}


// check if user is globally online
export function isUserGloballyOnline(userId) {
    const numericUserId = parseInt(userId, 10);
    return globalOnlineUsers.has(numericUserId);
}

// send toast msg to user's active windows
export function sendToastToUser(userId, toastData) {
    if (!presenceIoNamespace) {
        console.error("[Toast Service] Presence namespace not initialized. Cannot send toast.");
        return false;
    }

    const numericUserId = parseInt(userId, 10);
    if (isNaN(numericUserId)) {
        console.error(`[Toast Service] Invalid userId for toast: ${userId}`);
        return false;
    }

    const userData = globalOnlineUsers.get(numericUserId);
    if (userData && userData.socketIds.size > 0) {
        const fullToastData = {
            duration: 5000,
            viewText: 'View',
            ...toastData
        };

        console.log(`[Toast Service] Sending toast to user ${numericUserId} (sockets: ${userData.socketIds.size})`, fullToastData);
        userData.socketIds.forEach(socketId => {
            presenceIoNamespace.to(socketId).emit('showGlobalToast', fullToastData);
        });
        return true;
    } else {
        console.log(`[Toast Service] User ${numericUserId} not globally online or no active sockets. Toast not sent.`);
        return false;
    }
}