// src/player/player.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Player } from './entities/player.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PlayerService {
  constructor(
    @InjectRepository(Player)
    private playerRepository: Repository<Player>,
  ) {}

  async addPlayer(name: string): Promise<Player> {
    const player = this.playerRepository.create({
      name,
      score: 0,
      isReady: false,
    });
    return this.playerRepository.save(player);
  }

  async removePlayer(id: string): Promise<void> {
    await this.playerRepository.delete(id);
  }

  async getPlayers(): Promise<Player[]> {
    return this.playerRepository.find();
  }

  async getPlayerById(id: string): Promise<Player> {
    const player = await this.playerRepository.findOne({ where: { id } });
    if (!player) throw new Error("Player not found");
    return player;
  }

  async resetScore(id: string): Promise<Player> {
    const player = await this.getPlayerById(id);
    player.score = 0;
    return this.playerRepository.save(player);
  }

  async updateScore(id: string, scoreDelta: number): Promise<Player> {
    const player = await this.getPlayerById(id);
    player.score = (player.score || 0) + scoreDelta;
    // console.log("New score:", player.score);
    return this.playerRepository.save(player);
  }

  async getTopPlayers(limit: number = 5): Promise<Player[]> {
    return this.playerRepository.find({
      order: { score: 'DESC' },
      take: limit,
    });
  }
}
