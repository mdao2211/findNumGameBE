import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from './entities/room.entity';
import { RoomService } from './room.service';
import { RoomController } from './room.controller';
import { RoomPlayer } from 'src/game/entities/roomPlayer.entity';
import { Player } from 'src/player/entities/player.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Room, RoomPlayer, Player])],
  providers: [RoomService],
  controllers: [RoomController],
  exports: [RoomService],
})
export class RoomModule {}
