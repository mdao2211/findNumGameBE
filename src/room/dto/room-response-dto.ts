import { ApiProperty } from '@nestjs/swagger';
import { Room } from '../entities/room.entity';
export class RoomResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  status: string;

  constructor(room: Room) {
    this.id = room.id;
    this.name = room.name;
    this.createdAt = room.createdAt;
    this.status = room.status;
  }
}
