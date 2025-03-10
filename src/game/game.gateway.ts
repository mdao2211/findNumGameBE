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
    // Lưu record vào bảng RoomPlayer nếu chưa có
    await this.gameService.joinRoom(payload.roomId, payload.playerId);
    // Đếm số người trong phòng
    const count = await this.roomService.getPlayersCount(payload.roomId);
    const isHost = count === 1; // Người đầu tiên là host
    // Lấy thông tin người chơi đã tồn tại (không tạo mới)
    const player = await this.gameService['playerService'].getPlayerById(payload.playerId);
    // Gắn thuộc tính isHost cho người chơi
    const playerWithHost = Object.assign({}, player, { isHost });
    // Phát event cho tất cả client trong room
    this.server.to(payload.roomId).emit('room:playerJoined', playerWithHost);
    return playerWithHost;
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

}
