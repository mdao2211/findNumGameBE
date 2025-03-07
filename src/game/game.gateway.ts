import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';

@WebSocketGateway(5000, {
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly gameService: GameService) {}

  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    // Gửi trạng thái hiện tại của game cho client khi kết nối
    const state = await this.gameService.getGameState();
    client.emit('game:state', state);
  }

  async handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    // Nếu cần, bạn có thể xóa người chơi khỏi DB
    this.server.emit('player:leave', client.id);
  }

  @SubscribeMessage('player:join')
  async handlePlayerJoin(client: Socket, payload: { name: string }) {
    // Đăng ký người chơi mới thông qua GameService (với PlayerService bên trong)
    const player = await this.gameService['playerService'].addPlayer(
      payload.name,
    );
    this.server.emit('player:join', player);
    return player;
  }

  @SubscribeMessage('game:start')
  async handleGameStart() {
    try {
      const { number, timeRemaining } = await this.gameService.startGame();
      this.server.emit('game:number', number);
      this.server.emit('game:timeUpdate', timeRemaining);

      this.gameService.startTimer(
        (time) => this.server.emit('game:timeUpdate', time),
        async () => {
          const winner = await this.gameService.endGame();
          this.server.emit('game:end', winner);
        },
      );
    } catch (error) {
      console.error('Error starting game:', error.message);
    }
  }

  @SubscribeMessage('player:guess')
  async handlePlayerGuess(client: Socket, guess: number) {
    try {
      const result = await this.gameService.makeGuess(client.id, guess);
      if (result.correct) {
        // Nếu đoán đúng, game kết thúc và thông báo người chiến thắng
        const winner = await this.gameService.endGame();
        this.server.emit('game:end', winner);
      } else {
        client.emit('game:hint', result.message);
      }
      // Cập nhật điểm số cho tất cả người chơi
      const players = (await this.gameService.getGameState()).players;
      players.forEach((player) => {
        this.server.emit('game:updateScore', {
          playerId: player.id,
          score: player.score,
        });
      });
    } catch (error) {
      console.error('Error handling guess:', error.message);
    }
  }
}
