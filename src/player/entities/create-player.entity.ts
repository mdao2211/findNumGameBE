import { ApiProperty } from '@nestjs/swagger';

export class CreatePlayerDto {
  @ApiProperty({ example: 'Dao Manh', description: 'Tên của player' })
  name: string;
}
