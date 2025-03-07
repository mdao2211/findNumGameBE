import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PlayerService } from './player/player.service';
import { PlayerController } from './player/player.controller';
import { PlayerModule } from './player/player.module';
import { GameService } from './game/game.service';
import { GameGateway } from './game/game.gateway';
import { RoomController } from './room/room.controller';
import { RoomService } from './room/room.service';
import { Player } from './player/entities/player.entity';
import { RoomModule } from './room/room.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forFeature([Player]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule, PlayerModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: +(configService.get<number>('DB_PORT') ?? 5432),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [
          __dirname + '/**/*.entity{.ts,.js}',
          __dirname + '/**/*.entities{.ts,.js}',
        ],
        // synchronize: true,
      }),
      inject: [ConfigService],
    }),
    PlayerModule,
    RoomModule,
  ],
  controllers: [AppController],
  providers: [AppService, GameService, GameGateway],
})
export class AppModule {}
