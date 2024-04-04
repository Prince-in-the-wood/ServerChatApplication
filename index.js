const socket = require('socket.io');

const groups = new Set();
const users = new Map();

class Connection {
    constructor(io, socket) {
        this.socket = socket;
        this.io = io;

        socket.emit('available', { "users": Array.from(users.values()), "groups": Array.from(groups) });

        socket.on('join', (username) => this.joinChat(username));
        socket.on('join-group', (group) => this.joinGroup(group));
        socket.on('join-private', (username) => this.joinPrivate(username));

        socket.on('send-group-message', (message, group) => this.sendGroupMessage(message, group));

        socket.on('disconnect', () => this.disconnect());
        socket.on('connect_error', (err) => {
            console.log(`connect_error due to ${err.message}`);
        });
    }

    joinChat(username) {
        users.set(this.socket, username);
        this.io.sockets.emit('available', { "users": Array.from(users.values()), "groups": Array.from(groups) });
    }

    joinGroup(group) {
        this.socket.join(group);
        this.sendGroupMessage('joining', group)
        console.log(group)
    }

    joinPrivate(username) {
        console.log(username)
        return
    }

    sendGroupMessage(message, groups) {
        const msg = {
            chatName: groups,
            from: users.get(this.socket),
            message: message || "",
            time: (new Date()).toISOString()
        }
        this.io.sockets.to(groups).emit(groups, msg);
    }

    disconnect() {
        users.delete(this.socket);
    }
}

function chat(io) {
    io.on('connection', (socket) => {
        new Connection(io, socket);
    });
}

const io = socket(
    3000, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
}
)

chat(io)