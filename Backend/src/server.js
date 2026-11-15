require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
        status: 'OK',
        message: 'Collab Board Backend'
    }));
});

// Allowed origins — comma-separated list via CORS_ORIGIN env var
// (local dev: http://localhost:5173, prod: https://colab-gold.vercel.app)
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"]
    }
});

// ---------------- Room system ----------------
const MAX_ROOM_SIZE = 5;          // people per session/link
const MAX_ROOM_ELEMENTS = 20000;  // memory cap per room (oldest dropped)

// roomId -> { elements: [], members: Map<socketId, { username }> }
const rooms = new Map();

// Unambiguous alphabet (no 0/O, 1/I)
const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const genRoomId = () => {
    let id;
    do {
        id = Array.from(
            { length: 6 },
            () => ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)]
        ).join('');
    } while (rooms.has(id));
    return id;
};

const memberList = (room) =>
    [...room.members].map(([id, member]) => ({ id, username: member.username }));

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    const leaveCurrentRoom = () => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const room = rooms.get(roomId);
        socket.leave(roomId);
        socket.data.roomId = null;
        if (!room) return;
        room.members.delete(socket.id);
        io.to(roomId).emit('room-users', memberList(room));
        // Empty rooms are kept (until server restart) so shared links stay valid.
    };

    // ---- create a new session → returns the shareable room id ----
    socket.on('create-room', ({ username } = {}, cb) => {
        leaveCurrentRoom();
        const roomId = genRoomId();
        const room = {
            elements: [],
            members: new Map([[socket.id, { username: username || 'Guest' }]]),
        };
        rooms.set(roomId, room);
        socket.join(roomId);
        socket.data.roomId = roomId;
        io.to(roomId).emit('room-users', memberList(room));
        if (typeof cb === 'function') cb(null, { ok: true, roomId, elements: [], maxUsers: MAX_ROOM_SIZE });
    });

    // ---- join an existing session via shared link ----
    socket.on('join-room', ({ roomId, username } = {}, cb) => {
        const id = String(roomId || '').trim().toUpperCase();
        const room = rooms.get(id);
        if (!room) {
            if (typeof cb === 'function') cb(null, { ok: false, error: 'not-found' });
            return;
        }
        if (room.members.size >= MAX_ROOM_SIZE && !room.members.has(socket.id)) {
            if (typeof cb === 'function') cb(null, { ok: false, error: 'full' });
            return;
        }
        leaveCurrentRoom();
        socket.join(id);
        socket.data.roomId = id;
        room.members.set(socket.id, { username: username || 'Guest' });
        io.to(id).emit('room-users', memberList(room));
        if (typeof cb === 'function') {
            cb(null, { ok: true, roomId: id, elements: room.elements, maxUsers: MAX_ROOM_SIZE });
        }
    });

    socket.on('leave-room', () => leaveCurrentRoom());

    // ---- drawings: stored per room + relayed only within the room ----
    socket.on('draw', (data) => {
        const roomId = socket.data.roomId;
        if (!roomId) return;                 // not in a room → ignore
        const room = rooms.get(roomId);
        if (!room) return;
        if (room.elements.length >= MAX_ROOM_ELEMENTS) room.elements.shift();
        room.elements.push(data);
        socket.to(roomId).emit('draw', data); // everyone in the room except sender
    });

    // ---- clear: relayed to the whole room + wipes stored state ----
    socket.on('clear-board', () => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (room) room.elements = [];
        io.to(roomId).emit('clear-board');
    });

    // ---- chat: room-scoped ----
    socket.on('chat-message', (message) => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        io.to(roomId).emit('chat-message', {
            userId: socket.id,
            message,
            timestamp: new Date().toISOString(),
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        leaveCurrentRoom();
    });
});

// PORT comes from the host (Railway/Render assign one); 5000 for local dev
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`✅ Backend running on http://localhost:${PORT}`);
});
