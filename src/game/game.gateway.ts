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
@WebSocketGateway(5000, {
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly gameService: GameService, private readonly roomService: RoomService) {}

  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    const state = await this.gameService.getGameState();
    client.emit('game:state', state);
  }

  async handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.server.emit('player:leave', client.id);
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    client: Socket,
    payload: { roomId: string; playerId: string }
  ) {
    client.join(payload.roomId);
    await this.gameService.joinRoom(payload.roomId, payload.playerId);
    const count = await this.roomService.getPlayersCount(payload.roomId);
    const isHost = count === 1; 
    const player = await this.gameService['playerService'].getPlayerById(payload.playerId);
    const playerWithHost = Object.assign({}, player, { isHost });
    // console.log("Backend - playerWithHost:", playerWithHost);
    this.server.to(payload.roomId).emit('room:playerJoined', playerWithHost);
    return { success: true, player: playerWithHost };
  }

@SubscribeMessage('leaveRoom')
async handleLeaveRoom(
  client: Socket,
  payload: { roomId: string; playerId: string }
) {
  // Xóa record trong bảng RoomPlayer
  await this.gameService.leaveRoom(payload.roomId, payload.playerId);
  // Client rời khỏi room
  client.leave(payload.roomId);
  // Phát event cho các client trong room cập nhật số người chơi
  this.server.to(payload.roomId).emit('room:playerLeft', { playerId: payload.playerId });
  return { success: true };
}

  @SubscribeMessage('game:start')
  async handleGameStart(client: Socket, payload: { roomId: string }) {
    try {
      const { number, timeRemaining } = await this.gameService.startGame();
      // Phát event chỉ tới các client trong room đó
      this.server.to(payload.roomId).emit('game:number', number);
      this.server.to(payload.roomId).emit('game:timeUpdate', timeRemaining);

      this.gameService.startTimer(
        (time) => this.server.to(payload.roomId).emit('game:timeUpdate', time),
        async () => {
          const winner = await this.gameService.endGame();
          this.server.to(payload.roomId).emit('game:end', winner);
        },
      );
    } catch (error) {
      console.error('Error starting game:', error.message);
    }
  }

  @SubscribeMessage('player:correctGuess')
  async handleCorrectGuess(
    client: Socket,
    payload: { roomId: string; playerId: string; points: number }
  ) {
    try {
      const updatedPlayer = await this.gameService['playerService'].updateScore(payload.playerId, payload.points);
      // Phát event cập nhật điểm tới các client trong room
      this.server.to(payload.roomId).emit('score:updated', updatedPlayer);
      return { success: true, player: updatedPlayer };
    } catch (error) {
      console.error("Error updating score:", error);
      return { success: false, error: error.message };
    }
  }

}
