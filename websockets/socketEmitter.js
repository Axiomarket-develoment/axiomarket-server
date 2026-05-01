let io;

function initSocket(serverIo) {
  io = serverIo;
}

function emitToUser(userId, event, data) {
  if (!io) return;

  io.to(userId.toString()).emit(event, data);
}

module.exports = {
  initSocket,
  emitToUser,
};