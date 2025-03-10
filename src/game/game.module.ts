// game.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameService } from './game.service';
import { RoomPlayer } from './entities/roomPlayer.entity';
import { PlayerModule } from 'src/player/player.module';

@Module({
  imports: [TypeOrmModule.forFeature([RoomPlayer]), PlayerModule],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}
