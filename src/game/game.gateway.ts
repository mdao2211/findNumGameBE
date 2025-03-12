import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { RoomService } from 'src/room/room.service';

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://findnumgamefe-production.up.railway.app', 'http://localhost:5173'];

@WebSocketGateway({
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Map lưu host của mỗi phòng: key là roomId, value là playerId của host
  private roomHosts: Map<string, string> = new Map();

  constructor(
    private readonly gameService: GameService,
    private readonly roomService: RoomService,
  ) {}

  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    const state = await this.gameService.getGameState();
    client.emit('game:state', state);
  }

  async handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    // Kiểm tra và tái chỉ định host nếu cần
    this.roomHosts.forEach(async (hostId, roomId) => {
      if (hostId === client.id) {
        const clients = await this.server.in(roomId).fetchSockets();
        if (clients.length > 0) {
          const newHostId = clients[0].id;
          this.roomHosts.set(roomId, newHostId);
          this.server.to(roomId).emit('room:hostChanged', { hostId: newHostId });
        } else {
          this.roomHosts.delete(roomId);
        }
      }
    });
    this.server.emit('player:leave', client.id);
  }

  @SubscribeMessage('joinRoom')
async handleJoinRoom(
  client: Socket,
  payload: { roomId: string; playerId: string },
) {
  client.join(payload.roomId);
  await this.gameService.joinRoom(payload.roomId, payload.playerId);

  // Nếu phòng chưa có host, gán người chơi hiện tại làm host.
  let isHost = false;
  if (!this.roomHosts.has(payload.roomId)) {
    this.roomHosts.set(payload.roomId, payload.playerId);
    isHost = true;
  } else if (this.roomHosts.get(payload.roomId) === payload.playerId) {
    // Nếu người chơi đã là host (trường hợp reload) thì vẫn giữ role host.
    isHost = true;
  }

  const player = await this.gameService['playerService'].getPlayerById(
    payload.playerId,
  );
  const playerWithHost = { ...player, isHost };
  this.server.to(payload.roomId).emit('room:playerJoined', playerWithHost);
  return { success: true, player: playerWithHost };
}


  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    client: Socket,
    payload: { roomId: string; playerId: string },
  ) {
    await this.gameService.leaveRoom(payload.roomId, payload.playerId);
    client.leave(payload.roomId);
    // Nếu người rời phòng là host, tái chỉ định host
    if (this.roomHosts.get(payload.roomId) === payload.playerId) {
      const clients = await this.server.in(payload.roomId).fetchSockets();
      if (clients.length > 0) {
        const newHost = clients[0].id;
        this.roomHosts.set(payload.roomId, newHost);
        this.server.to(payload.roomId).emit('room:hostChanged', { hostId: newHost });
      } else {
        this.roomHosts.delete(payload.roomId);
      }
    }
    this.server.to(payload.roomId).emit('room:playerLeft', { playerId: payload.playerId });
    return { success: true };
  }

  @SubscribeMessage('game:start')
  async handleGameStart(
    client: Socket,
    payload: { roomId: string; playerId: string },
  ) {
    // Kiểm tra người gửi event có phải host của phòng không
    if (this.roomHosts.get(payload.roomId) !== payload.playerId) {
      return { success: false, error: "Only the host can start the game." };
    }
    try {
      const { number, timeRemaining } = await this.gameService.startGame();
      // Phát sự kiện đến tất cả client trong phòng
      this.server.to(payload.roomId).emit('game:number', number);
      this.server.to(payload.roomId).emit('game:timeUpdate', timeRemaining);

      this.gameService.startTimer(
        (time) => this.server.to(payload.roomId).emit('game:timeUpdate', time),
        async () => {
          const winner = await this.gameService.endGame();
          this.server.to(payload.roomId).emit('game:end', winner);
        },
      );
      return { success: true };
    } catch (error) {
      console.error('Error starting game:', error.message);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('player:resetScore')
  async handleResetScore(
    client: Socket,
    payload: { roomId: string; playerId: string },
  ) {
    try {
      const updatedPlayer = await this.gameService['playerService'].resetScore(
        payload.playerId,
      );
      this.server.to(payload.roomId).emit('score:updated', updatedPlayer);
      return { success: true, player: updatedPlayer };
    } catch (error: any) {
      console.error('Error resetting score:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('player:correctGuess')
  async handleCorrectGuess(
    client: Socket,
    payload: { roomId: string; playerId: string; points: number },
  ) {
    try {
      const updatedPlayer = await this.gameService['playerService'].updateScore(
        payload.playerId,
        payload.points,
      );
      this.server.to(payload.roomId).emit('score:updated', updatedPlayer);
      return { success: true, player: updatedPlayer };
    } catch (error) {
      console.error('Error updating score:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('player:wrongGuess')
  async handleWrongGuess(
    client: Socket,
    payload: { roomId: string; playerId: string; points: number },
  ) {
    try {
      const updatedPlayer = await this.gameService['playerService'].updateScore(
        payload.playerId,
        payload.points,
      );
      this.server.to(payload.roomId).emit('score:updated', updatedPlayer);
      return { success: true, player: updatedPlayer };
    } catch (error: any) {
      console.error('Error updating score for wrong guess:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('game:finish')
  async handleGameFinish(
    client: Socket,
    payload: { roomId: string; playerId: string; finalScore: number },
  ) {
    try {
      const updatedPlayer = await this.gameService['playerService'].updateScore(
        payload.playerId,
        0,
      );
      this.server.to(payload.roomId).emit('score:updated', updatedPlayer);
      return { success: true, player: updatedPlayer };
    } catch (error: any) {
      console.error('Error finishing game:', error);
      return { success: false, error: error.message };
    }
  }
}
