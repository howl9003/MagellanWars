import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import type { ServerToClientEvents, ClientToServerEvents } from '@magellanwars/shared';

export function createSocketServer(httpServer: HttpServer, clientOrigin: string) {
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: clientOrigin, credentials: true },
  });

  io.on('connection', (socket) => {
    socket.on('fleet:setMission', async (data) => {
      // TODO: validate auth token, call game service, emit updated fleet
      io.emit('fleet:updated', {
        ownerId: 0,
        id: data.fleetId,
        name: '',
        admiralId: null,
        status: 0,
        maxShips: 0,
        currentShips: 0,
        mission: 'standby',
        missionTarget: data.target ?? 0,
        missionTerminateTime: null,
        killedShips: 0,
        killedFleets: 0,
      });
    });
  });

  return io;
}
