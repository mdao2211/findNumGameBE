import { Injectable } from '@nestjs/common';
import { PlayerService } from 'src/player/player.service';
import { Player } from 'src/player/entities/player.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { RoomPlayer } from './entities/roomPlayer.entity';
import { Repository } from 'typeorm';
import { RoomResponseDto } from 'src/room/dto/room-response-dto';

@Injectable()
export class GameService {
  private currentNumber: number | null = null;
  private isGameStarted = false;
  private gameTimer: NodeJS.Timeout | null = null;
  private timeRemaining = 180; // 180 seconds = 3 minutes

  constructor(
    private readonly playerService: PlayerService,
    @InjectRepository(RoomPlayer)
    private roomPlayerRepository: Repository<RoomPlayer>,
  ) {}

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

  async joinRoom(roomId: string, playerId: string): Promise<void> {
    try {
      // First check if there are any players in the room
      const existingPlayers = await this.roomPlayerRepository.find({
        where: { roomId },
      });

      // Determine if this should be the host (first player in the room)
      const shouldBeHost = existingPlayers.length === 0;

      // Check if this player is already in the room
      const existingPlayer = await this.roomPlayerRepository.findOne({
        where: { roomId, playerId },
      });

      if (!existingPlayer) {
        // Create new room player entry
        const newRoomPlayer = this.roomPlayerRepository.create({
          roomId,
          playerId,
          isReady: false,
          isHost: shouldBeHost, // Set host status based on if they're first
        });
        await this.roomPlayerRepository.save(newRoomPlayer);
      } else {
        // If player already exists but room has no host, make them host
        if (!existingPlayers.some((player) => player.isHost)) {
          existingPlayer.isHost = true;
          await this.roomPlayerRepository.save(existingPlayer);
        }
      }
    } catch (error) {
      // Only ignore unique constraint violations
      if (error?.code === '23505') return;
      throw error;
    }
  }

  async leaveRoom(roomId: string, playerId: string): Promise<void> {
    await this.roomPlayerRepository.delete({ roomId, playerId });
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
