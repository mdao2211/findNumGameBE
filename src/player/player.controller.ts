import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PlayerService } from './player.service';
import { PlayerResponseDto } from './dto/player-response.dto';
import { CreatePlayerDto } from './entities/create-player.entity';
import { UpdateScoreDto } from './dto/update-score.dto';

@ApiTags('player')
@Controller('player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  // Create player
  @Post()
  @ApiOperation({ summary: 'Create a player' })
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: {
        id: 'a6f50dfd-1234-5678-90ab-cdef12345678',
        name: 'Dao Manh',
        score: 0,
        isReady: false,
      },
    },
  })
  async createPlayer(
    @Body() createPlayerDto: CreatePlayerDto,
  ): Promise<PlayerResponseDto> {
    const player = await this.playerService.addPlayer(createPlayerDto.name);
    return player;
  }

  // Get players
  @Get()
  @ApiOperation({ summary: 'Get all players' })
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: [
        {
          id: 'a6f50dfd-1234-5678-90ab-cdef12345678',
          name: 'Dao Manh',
          score: 1000,
          isReady: true,
        },
      ],
    },
  })
  async getPlayers(): Promise<PlayerResponseDto[]> {
    return await this.playerService.getPlayers();
  }

  // Delete player
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a player' })
  @ApiResponse({
    status: 200,
    description: 'Player deleted successfully',
    schema: {
      example: { message: 'Player deleted successfully' },
    },
  })
  async deletePlayer(@Param('id') id: string): Promise<{ message: string }> {
    await this.playerService.removePlayer(id);
    return { message: 'Player deleted successfully' };
  }

  // Update Score
  @Post('update-score')
  @ApiOperation({ summary: 'Update player score' })
  @ApiResponse({
    status: 200,
    description: 'Player score updated successfully',
    schema: {
      example: {
        id: 'a6f50dfd-1234-5678-90ab-cdef12345678',
        name: 'Dao Manh',
        score: 1500,
        isReady: false,
      },
    },
  })
  async updateScore(
    @Body() updateScoreDto: UpdateScoreDto,
  ): Promise<PlayerResponseDto> {
    const { id, score } = updateScoreDto;
    return await this.playerService.updateScore(id, score);
  }

  // Get top 5 players sorted by score descending
  @Get('top-5-players')
  @ApiOperation({ summary: 'Get top 5 players' })
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: [
        {
          id: 'a6f50dfd-1234-5678-90ab-cdef12345678',
          name: 'Dao Manh',
          score: 1500,
          isReady: true,
        },
        {
          id: 'b7g60efd-2345-6789-01bc-def234567890',
          name: 'Hai Tran',
          score: 1200,
          isReady: false,
        },
        // ...
      ],
    },
  })
  async getTopPlayers(): Promise<PlayerResponseDto[]> {
    return await this.playerService.getTopPlayers(5);
  }
}
