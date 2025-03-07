import { ApiProperty } from '@nestjs/swagger';
import { Player } from '../entities/player.entity';
export class PlayerResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  score: number;

  @ApiProperty()
  isReady: boolean;

  constructor(player: Player) {
    this.id = player.id;
    this.name = player.name;
    this.score = player.score;
    this.isReady = player.isReady;
  }
}
