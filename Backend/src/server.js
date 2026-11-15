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

const users = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    users.set(socket.id, { id: socket.id });
    
    socket.on('draw', (data) => {
        socket.broadcast.emit('draw', data);
    });
    
    socket.on('chat-message', (message) => {
        io.emit('chat-message', {
            userId: socket.id,
            message,
            timestamp: new Date().toISOString()
        });
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        users.delete(socket.id);
    });
});

// PORT comes from the host (Railway/Render assign one); 5000 for local dev
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`✅ Backend running on http://localhost:${PORT}`);
});