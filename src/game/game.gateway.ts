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
  : [
      'https://findnumgamefe-production.up.railway.app',
      'http://localhost:5173',
    ];

@WebSocketGateway({
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly gameService: GameService,
    private readonly roomService: RoomService,
  ) {}

  async handleConnection(client: Socket) {
    // console.log(`Client connected: ${client.id}`);
    const state = await this.gameService.getGameState();
    client.emit('game:state', state);
  }

  async handleDisconnect(client: Socket) {
    // console.log(`Client disconnected: ${client.id}`);
    this.server.emit('player:leave', client.id);
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    client: Socket,
    payload: { roomId: string; playerId: string; isHost?: boolean },
  ) {
    client.join(payload.roomId);
    await this.gameService.joinRoom(
      payload.roomId,
      payload.playerId,
      payload.isHost,
    );

    // Lấy record RoomPlayer từ DB để xác định isHost
    const roomPlayer = await this.gameService['roomPlayerRepository'].findOne({
      where: { roomId: payload.roomId, playerId: payload.playerId },
    });
    const isHost = roomPlayer?.isHost ?? false;

    const player = await this.gameService['playerService'].getPlayerById(
      payload.playerId,
    );
    const playerWithHost = { ...player, isHost };
    this.server.to(payload.roomId).emit('room:playerJoined', playerWithHost);

    const playersCount = await this.gameService['roomPlayerRepository'].count({
      where: { roomId: payload.roomId },
    });
    this.server
      .to(payload.roomId)
      .emit('room:playerCountUpdated', { playersCount });

    // Nếu game đã start, gửi trạng thái game cho client mới
    const roomGameState = this.gameService.getRoomGameState(payload.roomId);
    if (roomGameState && roomGameState.isGameStarted) {
      client.emit('game:started', {
        targetNumber: roomGameState.currentNumber,
        timeRemaining: roomGameState.timeRemaining,
      });
    }
    return { success: true, player: playerWithHost };
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    client: Socket,
    payload: { roomId: string; playerId: string },
  ) {
    const roomPlayer = await this.gameService['roomPlayerRepository'].findOne({
      where: { roomId: payload.roomId, playerId: payload.playerId },
    });

    await this.gameService.leaveRoom(payload.roomId, payload.playerId);
    client.leave(payload.roomId);

    if (roomPlayer && roomPlayer.isHost) {
      const otherRoomPlayers = await this.gameService[
        'roomPlayerRepository'
      ].find({
        where: { roomId: payload.roomId },
        order: { joinAt: 'ASC' },
      });
      if (otherRoomPlayers.length > 0) {
        const newHostPlayer = otherRoomPlayers[0];
        await this.gameService['roomPlayerRepository'].update(
          { id: newHostPlayer.id },
          { isHost: true },
        );
        this.server
          .to(payload.roomId)
          .emit('room:hostChanged', { hostId: newHostPlayer.playerId });
      }
    }
    this.server
      .to(payload.roomId)
      .emit('room:playerLeft', { playerId: payload.playerId });

    const playersCount = await this.gameService['roomPlayerRepository'].count({
      where: { roomId: payload.roomId },
    });
    this.server
      .to(payload.roomId)
      .emit('room:playerCountUpdated', { playersCount });

    return { success: true };
  }

  @SubscribeMessage('game:start')
  async handleGameStart(
    client: Socket,
    payload: { roomId: string; playerId: string },
  ) {
    const roomPlayer = await this.gameService['roomPlayerRepository'].findOne({
      where: { roomId: payload.roomId, playerId: payload.playerId },
    });
    if (!roomPlayer || !roomPlayer.isHost) {
      return { success: false, error: 'Only the host can start the game.' };
    }
    try {
      const { number, timeRemaining } = await this.gameService.startGame(
        payload.roomId,
      );
      this.server
        .to(payload.roomId)
        .emit('game:started', { targetNumber: number, timeRemaining });
      this.gameService.startTimer(
        payload.roomId,
        (time) => this.server.to(payload.roomId).emit('game:timeUpdate', time),
        async () => {
          const winner = await this.gameService.endGame(payload.roomId);
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
      // Cập nhật điểm cho người chơi
      const updatedPlayer = await this.gameService['playerService'].updateScore(
        payload.playerId,
        payload.points,
      );
      // Emit event cập nhật điểm cho toàn bộ room
      this.server.to(payload.roomId).emit('score:updated', updatedPlayer);

      // Tạo target number mới (trong khoảng 1-100)
      const newTargetNumber = Math.floor(Math.random() * 100) + 1;
      // Lấy trạng thái game của room
      const roomGameState = this.gameService.getRoomGameState(payload.roomId);
      if (roomGameState) {
        roomGameState.currentNumber = newTargetNumber;
      }
      // Emit event cập nhật target number mới cho toàn bộ room
      this.server.to(payload.roomId).emit('game:targetUpdate', newTargetNumber);

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
