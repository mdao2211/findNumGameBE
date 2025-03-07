import { Injectable } from '@nestjs/common';
import { PlayerService } from 'src/player/player.service';
import { Player } from 'src/player/entities/player.entity';

@Injectable()
export class GameService {
  private currentNumber: number | null = null;
  private isGameStarted = false;
  private gameTimer: NodeJS.Timeout | null = null;
  private timeRemaining = 180; // 180 seconds = 3 minutes

  constructor(private readonly playerService: PlayerService) {}

  async startGame() {
    const players = await this.playerService.getPlayers();
    if (players.length < 2) {
      throw new Error('Not enough players');
    }
    this.isGameStarted = true;
    // Sinh số ngẫu nhiên từ 1 đến 1000
    this.currentNumber = Math.floor(Math.random() * 1000) + 1;
    this.timeRemaining = 180;

    if (this.gameTimer) {
      clearInterval(this.gameTimer);
    }
    return {
      number: this.currentNumber,
      timeRemaining: this.timeRemaining,
    };
  }

  async makeGuess(
    playerId: string,
    guess: number,
  ): Promise<{ correct: boolean; message: string; scoreAwarded?: number }> {
    const players = await this.playerService.getPlayers();
    const player = players.find((p) => p.id === playerId);
    if (!player) throw new Error('Player not found');
    if (this.currentNumber === null) throw new Error('Game not started');

    if (guess === this.currentNumber) {
      // Nếu đoán đúng, tính điểm dựa trên thời gian còn lại.
      // Ví dụ: điểm = thời gian còn lại (max 180)
      const pointsAwarded = this.timeRemaining;
      const newScore = player.score + pointsAwarded;
      await this.playerService.updateScore(playerId, newScore);
      return {
        correct: true,
        message: 'Correct number!',
        scoreAwarded: pointsAwarded,
      };
    } else {
      return {
        correct: false,
        message: guess > this.currentNumber ? 'Too high!' : 'Too low!',
      };
    }
  }

  startTimer(callback: (time: number) => void, endCallback: () => void) {
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
    }
    this.gameTimer = setInterval(() => {
      this.timeRemaining--;
      callback(this.timeRemaining);
      if (this.timeRemaining <= 0) {
        this.endGame().then(() => endCallback());
      }
    }, 1000);
  }

  async endGame() {
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
    }
    this.isGameStarted = false;
    this.currentNumber = null;

    // Tìm người chiến thắng (người có điểm cao nhất)
    const players = await this.playerService.getPlayers();
    let winner: Player | null = null;
    let highestScore = -1;
    for (const player of players) {
      if (player.score > highestScore) {
        highestScore = player.score;
        winner = player;
      }
    }
    return winner;
  }

  async getGameState() {
    const players = await this.playerService.getPlayers();
    return {
      isStarted: this.isGameStarted,
      players,
      timeRemaining: this.timeRemaining,
    };
  }
}
