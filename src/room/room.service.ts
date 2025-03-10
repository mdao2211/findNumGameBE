import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Room } from './entities/room.entity';
import { Repository } from 'typeorm';
import { RoomResponseDto } from './dto/room-response-dto';
import { RoomPlayer } from 'src/game/entities/roomPlayer.entity';

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    @InjectRepository(RoomPlayer)
    private roomPlayerRepository: Repository<RoomPlayer>,
  ) {}

  async getPlayersCount(roomId: string): Promise<number> {
    // Đếm số record trong bảng RoomPlayer có roomId = room.id
    return await this.roomPlayerRepository.count({ where: { roomId } });
  }

  async getRooms(): Promise<RoomResponseDto[]> {
    // Lấy danh sách phòng từ bảng Room
    const rooms = await this.roomRepository.find();
  
    // Với mỗi phòng, đếm số người chơi từ bảng RoomPlayer
    const roomsWithCount: RoomResponseDto[] = await Promise.all(
      rooms.map(async (room) => {
        const count = await this.getPlayersCount(room.id);
        return new RoomResponseDto(room, count);
      })
    );
    return roomsWithCount;
  }

  async createRoom(name?: string): Promise<RoomResponseDto> {
    const room = this.roomRepository.create({
      name,
      status: 'waiting',
    });
    const savedRoom = await this.roomRepository.save(room);
    // Với room mới tạo, số người chơi bằng 0
    return new RoomResponseDto(savedRoom, 0);
  }

  async removeRoom(id: string): Promise<void> {
    await this.roomRepository.delete(id);
  }
}
