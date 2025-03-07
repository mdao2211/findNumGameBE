import { ApiProperty } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({ example: 'Room Of StrongPeach', description: 'Tên của room' })
  name: string;
}
