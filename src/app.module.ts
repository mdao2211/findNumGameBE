import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PlayerModule } from './player/player.module';
import { GameGateway } from './game/game.gateway';
import { Player } from './player/entities/player.entity';
import { RoomModule } from './room/room.module';
import { GameModule } from './game/game.module';

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
    GameModule,
  ],
  controllers: [AppController],
  providers: [AppService, GameGateway],
})
export class AppModule {}
