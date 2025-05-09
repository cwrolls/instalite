/*
Run as follows:  NODE_ENV=test npx jest __tests__/chat.test.js --detectOpenHandles
*/

const request = require('supertest');
const ioClient = require('socket.io-client');
const server = require('../routes/chat'); 
const baseUrl = 'http://localhost:3000'; 

jest.setTimeout(10000); 
process.env.NODE_ENV = 'test';
beforeAll(done => {
    server.listen(3000, done);
});

afterAll(done => {
    server.close(done);
});

describe('User Endpoints', () => {
    let alice;
    test('POST /login should create a new user and return the same user on subsequent logins', async () => {
        const res1 = await request(baseUrl)
            .post('/login')
            .send({ username: 'TestAlice' });
        expect(res1.status).toBe(200);
        expect(res1.body.user).toHaveProperty('id');
        alice = res1.body.user;

        const res2 = await request(baseUrl)
            .post('/login')
            .send({ username: 'TestAlice' });
        expect(res2.status).toBe(200);
        expect(res2.body.user.id).toBe(alice.id);
    });

    test('GET /users/:userId/friends should return an empty array for a new user', async () => {
        const loginRes = await request(baseUrl).post('/login').send({ username: 'TestAliceFriends' });
        const testUser = loginRes.body.user;

        const res = await request(baseUrl).get(`/users/${testUser.id}/friends`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.friends)).toBe(true);
        expect(res.body.friends.length).toBe(0);
    });
});
describe('Chat Invite and Session Endpoints', () => {
    let alice, bob, invite, chatSessionId;
    let aliceSocket, bobSocket;

    beforeAll(async () => {
        const resAlice = await request(baseUrl)
            .post('/login')
            .send({ username: 'AliceGroup' });
        alice = resAlice.body.user;

        const resBob = await request(baseUrl)
            .post('/login')
            .send({ username: 'BobGroup' });
        bob = resBob.body.user;
        const socketOptions = { transports: ['websocket'], forceNew: true, reconnection: false };
        aliceSocket = ioClient(baseUrl, socketOptions);
        bobSocket = ioClient(baseUrl, socketOptions);

        await new Promise((resolve) => {
            let connectCount = 0;
            const checkDone = () => {
                connectCount++;
                if (connectCount === 2) resolve();
            };

            aliceSocket.on('connect', () => {
                aliceSocket.emit('userOnline', alice.id);
                checkDone();
            });
            bobSocket.on('connect', () => {
                bobSocket.emit('userOnline', bob.id);
                checkDone();
            });

            aliceSocket.on('connect_error', (err) => console.error('AliceGroup connect_error:', err));
            bobSocket.on('connect_error', (err) => console.error('BobGroup connect_error:', err));
        });
    });


    afterAll(() => {
        if (aliceSocket) aliceSocket.disconnect();
        if (bobSocket) bobSocket.disconnect();
    });

    test('POST /chat/invite should send a chat invite to an online user (private chat)', (done) => {
        bobSocket.once('chatInvite', (data) => {
            try {
                expect(data).toHaveProperty('inviteId');
                expect(data.from).toBe(alice.id);
                expect(data.to).toBe(bob.id);
                invite = data; 
                done();
            } catch (err) {
                done(err);
            }
        });

        request(baseUrl)
            .post('/chat/invite')
            .send({ from: alice.id, to: bob.id })
            .end((err, res) => {
                if (err) return done(err);
                expect(res.status).toBe(200);
                expect(res.body.invite).toHaveProperty('inviteId');
            });
    });

    test('POST /chat/invite/respond should create a chat session on acceptance (private chat)', async () => {
        expect(invite).toBeDefined();
        expect(invite.inviteId).toBeDefined();

        const res = await request(baseUrl)
            .post('/chat/invite/respond')
            .send({ inviteId: invite.inviteId, accept: true });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('chatSessionId');
        chatSessionId = res.body.chatSessionId;

        const messagesRes = await request(baseUrl)
            .get(`/chat/${chatSessionId}/messages`);
        expect(messagesRes.status).toBe(200);
        expect(Array.isArray(messagesRes.body.messages)).toBe(true);
        expect(messagesRes.body.messages.length).toBe(0); 
    });

    test('POST /chat/invite should not allow duplicate group chats with the same members', async () => {
        const resCharlie = await request(baseUrl).post('/login').send({ username: 'CharlieGroup' });
        const charlie = resCharlie.body.user;
        const socketOptions = { transports: ['websocket'], forceNew: true, reconnection: false };
        const charlieSocket = ioClient(baseUrl, socketOptions);

        await new Promise((resolve, reject) => {
            charlieSocket.on('connect', () => {
                charlieSocket.emit('userOnline', charlie.id);
                resolve();
            });
            charlieSocket.on('connect_error', (err) => {
                 console.error('CharlieGroup connect_error:', err);
                 reject(err);
            });
        });

        let groupInvite;
        const invitePromise = new Promise((resolve) => {
             bobSocket.once('chatInvite', (data) => {
                 groupInvite = data;
                 resolve();
             });
        });


        const resInvite = await request(baseUrl)
            .post('/chat/invite')
            .send({ from: alice.id, to: bob.id, groupMembers: [charlie.id] }); 

        expect(resInvite.status).toBe(200);
        expect(resInvite.body.invite).toHaveProperty('inviteId');
        await invitePromise;
        expect(groupInvite).toBeDefined();


        const resGroupChat = await request(baseUrl)
            .post('/chat/invite/respond')
            .send({ inviteId: groupInvite.inviteId, accept: true });

        expect(resGroupChat.status).toBe(200);
        expect(resGroupChat.body).toHaveProperty('chatSessionId');
        const groupChatSessionId = resGroupChat.body.chatSessionId;


        const resDup = await request(baseUrl)
            .post('/chat/invite')
            .send({ from: alice.id, to: bob.id, groupMembers: [charlie.id] });


        expect(resDup.status).toBe(400); 
        expect(resDup.body.error).toMatch(/group chat with these members already exists/i); 

        charlieSocket.disconnect();
    });
});

describe('Chat Messaging and Leaving', () => {
    let alice, bob, invite, chatSessionId;
    let aliceSocket, bobSocket;


    beforeAll(async () => {
        const resAlice = await request(baseUrl)
            .post('/login')
            .send({ username: 'AliceMsg' });
        alice = resAlice.body.user;

        const resBob = await request(baseUrl)
            .post('/login')
            .send({ username: 'BobMsg' });
        bob = resBob.body.user;

        const socketOptions = { transports: ['websocket'], forceNew: true, reconnection: false };
        aliceSocket = ioClient(baseUrl, socketOptions);
        bobSocket = ioClient(baseUrl, socketOptions);

        await new Promise((resolve) => {
            let connectCount = 0;
            const checkDone = () => {
                connectCount++;
                if (connectCount === 2) resolve();
            };
            aliceSocket.on('connect', () => {
                aliceSocket.emit('userOnline', alice.id);
                checkDone();
            });
            bobSocket.on('connect', () => {
                bobSocket.emit('userOnline', bob.id);
                checkDone();
            });
            aliceSocket.on('connect_error', (err) => console.error('AliceMsg connect_error:', err));
            bobSocket.on('connect_error', (err) => console.error('BobMsg connect_error:', err));
        });
        let receivedInvite;
        const invitePromise = new Promise(resolve => {
            bobSocket.once('chatInvite', data => {
                receivedInvite = data;
                resolve();
            });
        });
        const inviteRes = await request(baseUrl)
            .post('/chat/invite')
            .send({ from: alice.id, to: bob.id });
        expect(inviteRes.status).toBe(200);
        await invitePromise;
        invite = receivedInvite;

    
        const acceptRes = await request(baseUrl)
            .post('/chat/invite/respond')
            .send({ inviteId: invite.inviteId, accept: true });
        expect(acceptRes.status).toBe(200);
        chatSessionId = acceptRes.body.chatSessionId;
        expect(chatSessionId).toBeDefined();
    });

    afterAll(() => {
        if (aliceSocket) aliceSocket.disconnect();
        if (bobSocket) bobSocket.disconnect();
    });


    test('POST /chat/:chatId/message should send a message and GET /chat/:chatId/messages should retrieve it', async () => {
        const messageText = 'Hello from AliceMsg';

        const messagePromise = new Promise(resolve => {
            bobSocket.once('chatMessage', (data) => {
                expect(data).toHaveProperty('chatId', chatSessionId);
                expect(data.message).toHaveProperty('message', messageText);
                expect(data.message).toHaveProperty('sender_id', alice.id);
                resolve();
            });
        });


        const sendRes = await request(baseUrl)
            .post(`/chat/${chatSessionId}/message`)
            .send({ sender: alice.id, message: messageText });

        expect(sendRes.status).toBe(200);
        expect(sendRes.body.message).toHaveProperty('id');
        expect(sendRes.body.message.message).toBe(messageText);
        expect(sendRes.body.message.sender_id).toBe(alice.id);

        await messagePromise;

        const messagesRes = await request(baseUrl)
            .get(`/chat/${chatSessionId}/messages`);

        expect(messagesRes.status).toBe(200);
        expect(Array.isArray(messagesRes.body.messages)).toBe(true);
        expect(messagesRes.body.messages.length).toBeGreaterThan(0); 
        const msg = messagesRes.body.messages.find(m => m.message === messageText && m.sender_id === alice.id);
        expect(msg).toBeDefined();
        expect(msg.chat_id).toBe(chatSessionId);
    });

    test('POST /chat/:chatId/leave should allow users to leave and delete the chat when the last member leaves', async () => {
        let messagesRes = await request(baseUrl).get(`/chat/${chatSessionId}/messages`);
        expect(messagesRes.status).toBe(200);
        const initialMessageCount = messagesRes.body.messages.length;
        expect(initialMessageCount).toBeGreaterThan(0);

        const bobLeaveRes = await request(baseUrl)
            .post(`/chat/${chatSessionId}/leave`)
            .send({ userId: bob.id });
        expect(bobLeaveRes.status).toBe(200);
        expect(bobLeaveRes.body.message).toBe('Left chat session');

        messagesRes = await request(baseUrl)
            .get(`/chat/${chatSessionId}/messages`);
        expect(messagesRes.status).toBe(200); 
        expect(messagesRes.body.messages.length).toBe(initialMessageCount);


        const aliceLeaveRes = await request(baseUrl)
            .post(`/chat/${chatSessionId}/leave`)
            .send({ userId: alice.id });
        expect(aliceLeaveRes.status).toBe(200);
        expect(aliceLeaveRes.body.message).toBe('Left chat session');

        const finalRes = await request(baseUrl)
            .get(`/chat/${chatSessionId}/messages`);

        expect(finalRes.status).toBe(200);
        expect(Array.isArray(finalRes.body.messages)).toBe(true);
        expect(finalRes.body.messages.length).toBe(0);
    });
});