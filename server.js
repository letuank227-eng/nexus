const { createServer } = require('http')
const { Server } = require('socket.io')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

const onlineUsers = new Map() // userId -> socketId
const userRooms = new Map()   // socketId -> [roomIds]

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res))

  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  })

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    // User comes online
    socket.on('user:online', ({ userId }) => {
      onlineUsers.set(userId, socket.id)
      socket.data.userId = userId
      io.emit('user:status', { userId, status: 'online' })
    })

    // Join room
    socket.on('room:join', ({ roomId }) => {
      socket.join(roomId)
      const rooms = userRooms.get(socket.id) || []
      rooms.push(roomId)
      userRooms.set(socket.id, rooms)
    })

    // Leave room
    socket.on('room:leave', ({ roomId }) => {
      socket.leave(roomId)
    })

    // New message
    socket.on('message:send', (message) => {
      io.to(message.roomId).emit('message:new', message)
    })

    // Typing indicator
    socket.on('typing:start', ({ roomId, userId, userName }) => {
      socket.to(roomId).emit('typing:start', { userId, userName })
    })
    socket.on('typing:stop', ({ roomId, userId }) => {
      socket.to(roomId).emit('typing:stop', { userId })
    })

    // Task update
    socket.on('task:update', (task) => {
      if (task.roomId) io.to(task.roomId).emit('task:updated', task)
      else io.emit('task:updated', task)
    })

    // Notification
    socket.on('notification:send', ({ targetUserId, notification }) => {
      const targetSocket = onlineUsers.get(targetUserId)
      if (targetSocket) {
        io.to(targetSocket).emit('notification:new', notification)
      }
    })

    // Disconnect
    socket.on('disconnect', () => {
      const userId = socket.data.userId
      if (userId) {
        onlineUsers.delete(userId)
        io.emit('user:status', { userId, status: 'offline' })
      }
      userRooms.delete(socket.id)
      console.log('Client disconnected:', socket.id)
    })
  })

  const PORT = process.env.PORT || 3000
  httpServer.listen(PORT, () => {
    console.log(`🚀 Nexus server running on http://localhost:${PORT}`)
  })
})
