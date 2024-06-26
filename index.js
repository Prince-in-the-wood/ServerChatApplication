const http = require('http');
const socket = require('socket.io');

const groups = new Set(); // keep the {isGroup : boolean , groupName : string}
const users = new Map(); // keep the map of {(socket , username)}

class Connection {
    constructor(io, socket) {
        this.socket = socket;
        this.io = io;

        socket.emit('available', { "users": Array.from(users.values()), "groups": Array.from(groups) });

        socket.on('change-username', (username) => this.joinChat(username));

        socket.on('join', (username) => this.joinChat(username));
        socket.on('join-group', (group) => this.joinGroup(group));
        socket.on('join-private', (username) => this.joinPrivate(username));

        socket.on('send-group-message', (message, group, isText) => this.sendGroupMessage(message, group, isText));
        socket.on('send-private-message', (message, username, isText) => this.sendPrivateMessage(message, username, isText));

        socket.on('disconnect', () => this.disconnect());
        socket.on('connect_error', (err) => {
            console.log(`connect_error due to ${err.message}`);
        });
    }

    joinChat(username) {
        if (Array.from(users.values()).includes(username)) {
            this.io.sockets.to(this.socket.id).emit('error', 'Username cannot be duplicated');
            return;
        }

        users.set(this.socket, username);
        this.io.sockets.emit('available', { "users": Array.from(users.values()), "groups": Array.from(groups) });
    }

    joinGroup(group) {
        this.socket.join(group);
        this.sendGroupMessage('joining', group, true);
        const groupNameArray = Array.from(groups).map(g => g[1]);
        if (!groupNameArray.includes(group)) {
            groups.add([true, group]);
            this.io.sockets.emit('available', { "users": Array.from(users.values()), "groups": Array.from(groups) });
        }
    }

    joinPrivate(targetUsername) {
        const targetSocket = [...users.entries()].find(([socket, username]) => username === targetUsername)?.[0];
        if (!targetSocket) {
            console.log(`Username ${targetUsername} not found`);
            return;
        }
        const myUsername = users.get(this.socket)
        const privateChat = this.hashPrivateChatName(myUsername, targetUsername);
        this.socket.join(privateChat);
        targetSocket.join(privateChat);
        this.sendPrivateMessage('joining', targetUsername, true)
        const groupNameArray = Array.from(groups).map(g => g[1]);
        if (!groupNameArray.includes(privateChat)) {
            groups.add([false, privateChat]);
            this.io.sockets.emit('available', { "users": Array.from(users.values()), "groups": Array.from(groups) });
        }
    }

    sendGroupMessage(message, group, isText) {
        const myUsername = users.get(this.socket)
        const msg = {
            chatName: group,
            from: myUsername,
            message: message || "",
            isText: isText,
            time: (new Date()).toISOString()
        }
        this.io.sockets.to(group).emit("group-" + group, msg);
    }

    sendPrivateMessage(message, targetUsername, isText) {
        const targetSocket = [...users.entries()].find(([socket, username]) => username === targetUsername)?.[0];
        if (!targetSocket) {
            console.log(`Username ${targetUsername} not found`);
            return;
        }
        const myUsername = users.get(this.socket);
        const privateChat = this.hashPrivateChatName(myUsername, targetUsername);
        const msg = {
            chatName: privateChat,
            from: myUsername,
            message: message || "",
            isText: isText,
            time: (new Date()).toISOString()
        }
        this.io.sockets.to(privateChat).emit("private-" + privateChat, msg);
    }

    hashPrivateChatName(username1, username2) {
        if (username2 < username1) [username1, username2] = [username2, username1]
        return `${username1}-${username2}`;
    }

    disconnect() {
        users.delete(this.socket);
        this.io.sockets.emit('available', { "users": Array.from(users.values()), "groups": Array.from(groups) });
    }
}

function chat(io) {
    io.on('connection', (socket) => {
        new Connection(io, socket);
    });
}

const PORT = process.env.PORT || 3000

const server = http.createServer();
server.listen(PORT, () => {
    console.log(`Server running at PORT ${PORT}`);
});

const io = socket(
    server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
}
)

chat(io)