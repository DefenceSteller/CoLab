class SocketHandlers {
    constructor(io) {
        this.io = io;
        this.users = new Map();
        this.boardHistory = [];
    }

    handleConnection(socket) {
        console.log(`User connected: ${socket.id}`);
        
        const user = {
            id: socket.id,
            joinedAt: new Date(),
            cursor: { x: 0, y: 0 },
            color: '#000000',
            tool: 'pencil'
        };
        
        this.users.set(socket.id, user);
        
        // Notify others
        socket.broadcast.emit('user-joined', {
            id: socket.id,
            totalUsers: this.users.size
        });
        
        // Send current board state to new user
        socket.emit('board-state', this.boardHistory);
        
        // Set up event listeners
        this.setupEventListeners(socket);
    }

    setupEventListeners(socket) {
        // Drawing events
        socket.on('draw', (data) => {
            this.boardHistory.push({
                ...data,
                userId: socket.id,
                timestamp: new Date()
            });
            
            // Keep only last 100 drawings
            if (this.boardHistory.length > 100) {
                this.boardHistory.shift();
            }
            
            socket.broadcast.emit('draw', {
                ...data,
                userId: socket.id
            });
        });
        
        // Cursor movement
        socket.on('cursor-move', (position) => {
            if (this.users.has(socket.id)) {
                this.users.get(socket.id).cursor = position;
            }
            
            socket.broadcast.emit('cursor-move', {
                id: socket.id,
                ...position
            });
        });
        
        // Clear board
        socket.on('clear-board', () => {
            this.boardHistory = [];
            this.io.emit('clear-board', { userId: socket.id });
        });
        
        // Chat messages
        socket.on('chat-message', (message) => {
            this.io.emit('chat-message', {
                userId: socket.id,
                message,
                timestamp: new Date().toISOString()
            });
        });
        
        // Disconnection
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
            this.users.delete(socket.id);
            
            socket.broadcast.emit('user-left', {
                id: socket.id,
                totalUsers: this.users.size
            });
        });
    }
}

export default SocketHandlers;