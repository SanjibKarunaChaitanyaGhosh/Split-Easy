// Lets controllers push real-time events without importing socket.js (avoids circular imports).
let io = null
export const setIO = (instance) => { io = instance }
export const getIO = () => io
export const emitToUser = (userId, event, payload) => io?.to(`user:${userId}`).emit(event, payload)
export const emitToTrip = (tripId, event, payload) => io?.to(`trip:${tripId}`).emit(event, payload)
