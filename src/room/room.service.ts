import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Room } from './entities/room.entity';
import { In, Repository } from 'typeorm';
import { RoomResponseDto } from './dto/room-response-dto';
import { RoomPlayer } from 'src/game/entities/roomPlayer.entity';
import { Player } from 'src/player/entities/player.entity';
import { Cache } from 'cache-manager';

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    @InjectRepository(RoomPlayer)
    private roomPlayerRepository: Repository<RoomPlayer>,
    @InjectRepository(Player)
    private playerRepository: Repository<Player>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async getPlayersCount(roomId: string): Promise<number> {
    // Đếm số record trong bảng RoomPlayer có roomId = room.id
    return await this.roomPlayerRepository.count({ where: { roomId } });
  }

  async getRooms(): Promise<RoomResponseDto[]> {
    // Kiểm tra cache trước khi truy vấn DB
    const cachedRooms = await this.cacheManager.get<RoomResponseDto[]>('rooms');
    if (cachedRooms) {
      return cachedRooms;
    }

    const rooms = await this.roomRepository.find();
    // Với mỗi phòng, đếm số người chơi từ bảng RoomPlayer
    const roomsWithCount: RoomResponseDto[] = await Promise.all(
      rooms.map(async (room) => {
        const count = await this.getPlayersCount(room.id);
        return new RoomResponseDto(room, count);
      }),
    );
    // Lưu kết quả vào cache với TTL 60 giây
    await this.cacheManager.set('rooms', roomsWithCount, 60);
    return roomsWithCount;
  }

  async createRoom(name: string): Promise<RoomResponseDto> {
    const room = this.roomRepository.create({
      name,
      status: 'waiting',
    });
    const savedRoom = await this.roomRepository.save(room);
    // Khi tạo phòng mới, invalidate cache danh sách phòng
    await this.cacheManager.del('rooms');
    return new RoomResponseDto(savedRoom, 0);
  }

  async removeRoom(id: string): Promise<void> {
    await this.roomRepository.delete(id);
    // Invalidate cache sau khi xoá phòng
    await this.cacheManager.del('rooms');
  }

  async getRoomLeaderboard(roomId: string): Promise<Player[]> {
    const cacheKey = `room:${roomId}:leaderboard`;
    // Kiểm tra cache cho leaderboard của phòng
    const cachedLeaderboard = await this.cacheManager.get<Player[]>(cacheKey);
    if (cachedLeaderboard) {
      return cachedLeaderboard;
    }
    // Lấy danh sách playerId từ bảng RoomPlayer
    const roomPlayers = await this.roomPlayerRepository.find({
      where: { roomId },
    });
    const playerIds = roomPlayers.map((rp) => rp.playerId);
    if (playerIds.length === 0) return [];
    // Lấy danh sách người chơi từ PlayerRepository, sắp xếp theo score giảm dần
    const leaderboard = await this.playerRepository.find({
      where: { id: In(playerIds) },
      order: { score: 'DESC' },
    });
    // Lưu leaderboard vào cache với TTL 60 giây
    await this.cacheManager.set(cacheKey, leaderboard, 60);
    return leaderboard;
  }
}
