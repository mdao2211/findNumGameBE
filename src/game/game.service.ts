// src/game.service.ts
import { Injectable } from '@nestjs/common';
import { PlayerService } from 'src/player/player.service';
import { Player } from 'src/player/entities/player.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { RoomPlayer } from './entities/roomPlayer.entity';
import { Repository } from 'typeorm';

interface RoomGameState {
  currentNumber: number | null;
  isGameStarted: boolean;
  timeRemaining: number;
  gameTimer: NodeJS.Timeout | null;
}

@Injectable()
export class GameService {
  // Lưu trạng thái game theo roomId
  private games: Map<string, RoomGameState> = new Map();

  constructor(
    private readonly playerService: PlayerService,
    @InjectRepository(RoomPlayer)
    public roomPlayerRepository: Repository<RoomPlayer>,
  ) {}

  async startGame(
    roomId: string,
  ): Promise<{ number: number; timeRemaining: number }> {
    // Kiểm tra số lượng người trong room
    const playersInRoom = await this.roomPlayerRepository.find({
      where: { roomId },
    });
    if (playersInRoom.length < 2) {
      throw new Error('Not enough players');
    }
    const number = Math.floor(Math.random() * 100) + 1;
    const timeRemaining = 180;
    // Lưu trạng thái game cho room
    const gameState: RoomGameState = {
      currentNumber: number,
      isGameStarted: true,
      timeRemaining,
      gameTimer: null,
    };
    this.games.set(roomId, gameState);

    console.log(`Game started in room ${roomId} with target number: ${number}`);

    // Nếu có timer trước đó, xoá nó
    if (gameState.gameTimer) {
      clearInterval(gameState.gameTimer);
    }
    return { number, timeRemaining };
  }

  // Phương thức khởi chạy timer cho room
  startTimer(
    roomId: string,
    callback: (time: number) => void,
    endCallback: () => void,
  ) {
    const gameState = this.games.get(roomId);
    if (!gameState) return;
    if (gameState.gameTimer) {
      clearInterval(gameState.gameTimer);
    }
    gameState.gameTimer = setInterval(() => {
      gameState.timeRemaining--;
      callback(gameState.timeRemaining);
      if (gameState.timeRemaining <= 0) {
        this.endGame(roomId).then(() => endCallback());
      }
    }, 1000);
  }

  async endGame(roomId: string) {
    const gameState = this.games.get(roomId);
    if (gameState && gameState.gameTimer) {
      clearInterval(gameState.gameTimer);
      gameState.gameTimer = null;
    }
    if (gameState) {
      gameState.isGameStarted = false;
      gameState.currentNumber = null;
    }
    // Tìm người chiến thắng (đơn giản dựa vào player score)
    const players = await this.playerService.getPlayers();
    let winner: Player | null = null;
    let highestScore = -1;
    for (const player of players) {
      if (player.score > highestScore) {
        highestScore = player.score;
        winner = player;
      }
    }
    // Xoá trạng thái game của room sau khi kết thúc
    this.games.delete(roomId);
    return winner;
  }

  // Lấy trạng thái game của room (nếu có)
  getRoomGameState(roomId: string) {
    return this.games.get(roomId);
  }

  async joinRoom(
    roomId: string,
    playerId: string,
    isHostFlag?: boolean,
  ): Promise<void> {
    try {
      let existingPlayer = await this.roomPlayerRepository.findOne({
        where: { roomId, playerId },
      });
      if (existingPlayer) {
        // Nếu đã tồn tại, nếu payload báo là host và record hiện tại không phải host, cập nhật lại
        if (isHostFlag && !existingPlayer.isHost) {
          existingPlayer.isHost = true;
          await this.roomPlayerRepository.save(existingPlayer);
        }
      } else {
        // Nếu record chưa tồn tại, xác định shouldBeHost
        const count = await this.roomPlayerRepository.count({
          where: { roomId },
        });
        const shouldBeHost = isHostFlag || count === 0;
        const newRoomPlayer = this.roomPlayerRepository.create({
          roomId,
          playerId,
          isReady: false,
          isHost: shouldBeHost,
        });
        await this.roomPlayerRepository.save(newRoomPlayer);
      }
    } catch (error) {
      if (error?.code === '23505') return;
      throw error;
    }
  }

  async leaveRoom(roomId: string, playerId: string): Promise<void> {
    await this.roomPlayerRepository.delete({ roomId, playerId });
  }

  async getGameState() {
    const players = await this.playerService.getPlayers();
    return {
      // Global state, không dùng nữa cho game per room
      players,
      timeRemaining: 0,
    };
  }
}
