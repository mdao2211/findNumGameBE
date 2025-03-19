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
  availableNumbers: number[];
}

@Injectable()
export class GameService {
  private games: Map<string, RoomGameState> = new Map();

  constructor(
    private readonly playerService: PlayerService,
    @InjectRepository(RoomPlayer)
    private readonly roomPlayerRepository: Repository<RoomPlayer>,
  ) {}

  // Tạo mảng số từ 1 đến 100
  private generateNumbers(): number[] {
    return Array.from({ length: 100 }, (_, i) => i + 1);
  }

  // Chọn một số ngẫu nhiên từ availableNumbers và loại nó khỏi mảng
  private pickNumber(gameState: RoomGameState): number | null {
    if (gameState.availableNumbers.length === 0) {
      return null;
    }
    const randomIndex = Math.floor(
      Math.random() * gameState.availableNumbers.length,
    );
    const number = gameState.availableNumbers[randomIndex];
    // Loại bỏ số đã chọn
    gameState.availableNumbers.splice(randomIndex, 1);
    console.log(
      `Picked number: ${number}. Remaining: ${gameState.availableNumbers}`,
    );
    return number;
  }

  async startGame(
    roomId: string,
  ): Promise<{ number: number; timeRemaining: number }> {
    const playersInRoom = await this.roomPlayerRepository.find({
      where: { roomId },
    });
    if (playersInRoom.length < 2) {
      throw new Error('Not enough players');
    }

    for (const roomPlayer of playersInRoom) {
      await this.playerService.resetScore(roomPlayer.playerId);
    }

    // Tạo mảng số từ 1 đến 100
    const availableNumbers = this.generateNumbers();
    // Số khởi đầu là 1
    const initialNumber = 1;
    // Nếu bạn muốn loại bỏ số 1 khỏi mảng availableNumbers (vì đã dùng)
    const index = availableNumbers.indexOf(initialNumber);
    if (index !== -1) {
      availableNumbers.splice(index, 1);
    }
    const timeRemaining = 180;
    const gameState: RoomGameState = {
      currentNumber: initialNumber,
      isGameStarted: true,
      timeRemaining,
      gameTimer: null,
      availableNumbers,
    };
    this.games.set(roomId, gameState);
    if (gameState.gameTimer) clearInterval(gameState.gameTimer);
    return { number: initialNumber, timeRemaining };
  }

  startTimer(
    roomId: string,
    callback: (time: number) => void,
    endCallback: () => void,
  ) {
    const gameState = this.games.get(roomId);
    if (!gameState) return;
    if (gameState.gameTimer) clearInterval(gameState.gameTimer);
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
    const players = await this.playerService.getPlayers();
    let winner: Player | null = null;
    let highestScore = -1;
    for (const player of players) {
      if (player.score > highestScore) {
        highestScore = player.score;
        winner = player;
      }
    }
    this.games.delete(roomId);
    return winner;
  }

  getRoomGameState(roomId: string) {
    return this.games.get(roomId);
  }

  async joinRoom(
    roomId: string,
    playerId: string,
    isHostFlag?: boolean,
  ): Promise<void> {
    try {
      const existingPlayer = await this.roomPlayerRepository.findOne({
        where: { roomId, playerId },
      });
      if (existingPlayer) {
        if (isHostFlag && !existingPlayer.isHost) {
          existingPlayer.isHost = true;
          await this.roomPlayerRepository.save(existingPlayer);
        }
      } else {
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
    return { players, timeRemaining: 0 };
  }

  // Xử lý khi một player đoán đúng:
  // Loại bỏ số hiện tại khỏi availableNumbers và random số mới từ các số còn lại.
  async handleCorrectGuess(roomId: string): Promise<number | null> {
    const roomGameState = this.getRoomGameState(roomId);
    if (!roomGameState) return null;
    const newTarget = this.pickNumber(roomGameState);
    if (newTarget === null) {
      console.log('No available numbers left');
      return null;
    }
    roomGameState.currentNumber = newTarget;
    console.log(`New target number is ${newTarget}`);
    return newTarget;
  }

  // Thêm các phương thức hỗ trợ để ẩn truy vấn DB
  async getRoomPlayer(roomId: string, playerId: string) {
    return await this.roomPlayerRepository.findOne({
      where: { roomId, playerId },
    });
  }

  async countRoomPlayers(roomId: string): Promise<number> {
    return await this.roomPlayerRepository.count({ where: { roomId } });
  }
}
