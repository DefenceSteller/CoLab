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

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
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

const PORT = 5000;
server.listen(PORT, () => {
    console.log(`✅ Backend running on http://localhost:${PORT}`);
});