import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class UpdateScoreDto {
  @ApiProperty({ example: 'a6f50dfd-1234-5678-90ab-cdef12345678' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ example: 1500 })
  @IsNumber()
  score: number;
}
