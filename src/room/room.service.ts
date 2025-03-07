import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Room } from './entities/room.entity';
import { Repository } from 'typeorm';

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
  ) {}

  // Get All Rooms
  async getRooms(): Promise<Room[]> {
    return this.roomRepository.find();
  }

  // Create Room
  async createRoom(name?: string): Promise<Room> {
    const room = this.roomRepository.create({
      name,
      status: 'waiting',
    });
    return this.roomRepository.save(room);
  }

  // Delete Room
  async removeRoom(id: string): Promise<void> {
    await this.roomRepository.delete(id);
  }
}
