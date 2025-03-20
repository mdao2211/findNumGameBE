import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { PlayerService } from 'src/player/player.service';

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

  private playerColors: Map<string, string> = new Map();

  constructor(
    private readonly gameService: GameService,
    private readonly playerService: PlayerService,
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

    const roomPlayer = await this.gameService.getRoomPlayer(
      payload.roomId,
      payload.playerId,
    );
    const isHost = roomPlayer?.isHost ?? false;

    const player = await this.playerService.getPlayerById(payload.playerId);

    // Gán màu duy nhất cho người chơi nếu chưa có
    let playerColor = this.playerColors.get(payload.playerId);
    if (!playerColor) {
      playerColor =
        '#' +
        Math.floor(Math.random() * 16777215)
          .toString(16)
          .padStart(6, '0');
      this.playerColors.set(payload.playerId, playerColor);
    }

    const playerWithHostAndColor = { ...player, isHost, color: playerColor };

    // Phát event cho tất cả trong room biết ai đã join
    this.server
      .to(payload.roomId)
      .emit('room:playerJoined', playerWithHostAndColor);

    const playersCount = await this.gameService.countRoomPlayers(
      payload.roomId,
    );
    this.server
      .to(payload.roomId)
      .emit('room:playerCountUpdated', { playersCount });

    const roomGameState = this.gameService.getRoomGameState(payload.roomId);
    if (roomGameState && roomGameState.isGameStarted) {
      client.emit('game:started', {
        targetNumber: roomGameState.currentNumber,
        timeRemaining: roomGameState.timeRemaining,
      });
    }
    return { success: true, player: playerWithHostAndColor };
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
    payload: {
      roomId: string;
      playerId: string;
      points: number;
      guessedNumber: number;
    },
  ) {
    try {
      // Cập nhật điểm cho người chơi
      const updatedPlayer = await this.gameService['playerService'].updateScore(
        payload.playerId,
        payload.points,
      );
      // Phát event cập nhật điểm cho toàn bộ room
      this.server.to(payload.roomId).emit('score:updated', updatedPlayer);

      // Logic tăng dần target number
      const roomGameState = this.gameService.getRoomGameState(payload.roomId);
      let newTargetNumber = 1; // nếu chưa có hoặc đạt 100 thì reset về 1
      if (roomGameState) {
        if (
          roomGameState.currentNumber === null ||
          roomGameState.currentNumber >= 100
        ) {
          newTargetNumber = 1;
        } else {
          newTargetNumber = roomGameState.currentNumber + 1;
        }
        roomGameState.currentNumber = newTargetNumber;
      }

      // Phát event cập nhật số mục tiêu mới cho toàn room
      this.server.to(payload.roomId).emit('game:targetUpdate', newTargetNumber);

      const playerColor = this.playerColors.get(payload.playerId);
      if (!playerColor) {
        // playerColor =
        //   '#' +
        //   Math.floor(Math.random() * 16777215)
        //     .toString(16)
        //     .padStart(6, '0');
        // this.playerColors.set(payload.playerId, playerColor);

        console.error(`Không tìm thấy màu của player ${payload.playerId}`);
      }

      this.server.to(payload.roomId).emit('game:numberCorrect', {
        guessedNumber: payload.guessedNumber,
        color: playerColor,
      });

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
