import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Player } from './entities/player.entity';
import { Repository } from 'typeorm';
import { Cache } from 'cache-manager';

@Injectable()
export class PlayerService {
  constructor(
    @InjectRepository(Player)
    private playerRepository: Repository<Player>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async addPlayer(name?: string): Promise<Player> {
    const player = this.playerRepository.create({
      name,
      score: 0,
      isReady: false,
    });
    const savedPlayer = await this.playerRepository.save(player);
    // Invalidate cache liên quan khi thêm player mới
    await this.cacheManager.del('players');
    await this.cacheManager.del('top_players');
    return savedPlayer;
  }

  async removePlayer(id: string): Promise<void> {
    await this.playerRepository.delete(id);
    // Invalidate cache sau khi xoá player
    await this.cacheManager.del('players');
    await this.cacheManager.del('top_players');
  }

  async getPlayers(): Promise<Player[]> {
    // Kiểm tra cache trước khi truy vấn DB
    const cachedPlayers = await this.cacheManager.get<Player[]>('players');
    if (cachedPlayers) {
      return cachedPlayers;
    }
    const players = await this.playerRepository.find();
    await this.cacheManager.set('players', players, 60); // TTL 60 giây
    return players;
  }

  async getPlayerById(id: string): Promise<Player> {
    const player = await this.playerRepository.findOne({ where: { id } });
    if (!player) {
      throw new Error('Player not found');
    }
    return player;
  }

  async resetScore(id: string): Promise<Player> {
    const player = await this.playerRepository.findOne({ where: { id } });
    if (!player) throw new Error('Player not found');
    player.score = 0;
    const updatedPlayer = await this.playerRepository.save(player);
    // Invalidate cache khi score thay đổi
    await this.cacheManager.del('players');
    await this.cacheManager.del('top_players');
    return updatedPlayer;
  }

  async updateScore(id: string, score: number): Promise<Player> {
    const player = await this.playerRepository.findOne({ where: { id } });
    if (!player) {
      throw new Error('Player not found');
    }
    player.score = Math.max(0, (player.score || 0) + score);
    const updatedPlayer = await this.playerRepository.save(player);
    // Invalidate cache khi score thay đổi
    await this.cacheManager.del('players');
    await this.cacheManager.del('top_players');
    return updatedPlayer;
  }

  async getTopPlayers(limit: number = 5): Promise<Player[]> {
    const cacheKey = `top_players_${limit}`;
    const cachedTopPlayers = await this.cacheManager.get<Player[]>(cacheKey);
    if (cachedTopPlayers) {
      return cachedTopPlayers;
    }
    const players = await this.playerRepository.find({
      order: { score: 'DESC' },
      take: limit,
    });
    await this.cacheManager.set(cacheKey, players, 60);
    return players;
  }
}
