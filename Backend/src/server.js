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
        // Notify remaining members
        io.to(roomId).emit('user-left', { id: socket.id });
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

    // ---- drawings: upsert by id (store + relay) ----
    // The old behavior appended every draw, causing duplicates after
    // move/resize/rotate re-emitted the same element object.  Now we
    // replace any existing entry with the same id so replays are clean.
    socket.on('draw', (data) => {
        const roomId = socket.data.roomId;
        if (!roomId) return;                 // not in a room → ignore
        const room = rooms.get(roomId);
        if (!room) return;
        if (room.elements.length >= MAX_ROOM_ELEMENTS) room.elements.shift();
        // Upsert: replace existing element with same id, or append
        const idx = room.elements.findIndex((el) => el && el.id === data.id);
        if (idx >= 0) {
            room.elements[idx] = data;
        } else {
            room.elements.push(data);
        }
        socket.to(roomId).emit('draw', data); // everyone except sender
    });

    // ---- explicit element-update relay (move/resize final state) ----
    // Same semantics as draw — upsert + broadcast.  Used so the frontend
    // can distinguish "new element" from "existing element changed position".
    socket.on('update-elements', (updates) => {
        // updates = array of {id, ...rest}  OR  single element object (legacy compat)
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room) return;
        const items = Array.isArray(updates) ? updates : [updates];
        for (const el of items) {
            const idx = room.elements.findIndex((e) => e && e.id === el.id);
            if (idx >= 0) {
                room.elements[idx] = el;
            } else {
                room.elements.push(el);
            }
        }
        socket.to(roomId).emit('update-elements', updates);
    });

    // ---- eraser: remove by id — prune room state + relay to the room ----
    socket.on('delete-elements', (ids) => {
        const roomId = socket.data.roomId;
        if (!roomId || !Array.isArray(ids) || ids.length === 0) return;
        const room = rooms.get(roomId);
        if (!room) return;
        const idSet = new Set(ids);
        room.elements = room.elements.filter((el) => el && !idSet.has(el.id));
        socket.to(roomId).emit('delete-elements', ids);
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

    // ---- cursor position: broadcast within room ----
    socket.on('cursor-move', (data) => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        // data = { x, y, tool, username }
        socket.to(roomId).emit('cursor-move', {
            id: socket.id,
            username: data?.username ?? socket.data.username ?? 'Guest',
            x: data?.x,
            y: data?.y,
            tool: data?.tool,
            timestamp: Date.now(),
        });
    });

    // ---- laser trail points: relay individual points to room ----
    // Each point fades on receiver side via rAF trim loop; nothing stored.
    socket.on('laser-point', (point) => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        point.userId = socket.id;
        socket.to(roomId).emit('laser-point', point);
    });

    // ---- selection change: notify room (nice-to-have) ----
    socket.on('selection-change', (selectedIds) => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        socket.to(roomId).emit('selection-change', {
            id: socket.id,
            selectedIds,
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
