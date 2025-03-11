import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoomResponseDto } from './dto/room-response-dto';
import { RoomService } from './room.service';
import { CreateRoomDto } from './entities/create-room.entity';
import { Player } from 'src/player/entities/player.entity';

@ApiTags('room')
@Controller('room')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  // Get rooms
  @Get()
  @ApiOperation({ summary: 'Get all rooms' })
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: [
        {
          id: 'a6f50dfd-1234-5678-90ab-cdef12345678',
          name: 'Room 1',
          createdAt: '2025-03-07 14:05:32.772',
          status: 'waiting',
        },
      ],
    },
  })
  async getRooms(): Promise<RoomResponseDto[]> {
    return await this.roomService.getRooms();
  }

  // Create room
  @Post()
  @ApiOperation({ summary: 'Create a room' })
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: {
        id: 'a6f50dfd-1234-5678-90ab-cdef12345678',
        name: 'Room Of Peach',
        status: 'waiting',
      },
    },
  })
  async createRoom(
    @Body() createRoomDto: CreateRoomDto,
  ): Promise<RoomResponseDto> {
    const room = await this.roomService.createRoom(createRoomDto.name);
    return room;
  }

  // Delete room
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a room' })
  @ApiResponse({
    status: 200,
    description: 'Room deleted successfully',
    schema: {
      example: { message: 'Room deleted successfully' },
    },
  })
  async deleteRoom(@Param('id') id: string): Promise<{ message: string }> {
    await this.roomService.removeRoom(id);
    return { message: 'Room deleted successfully' };
  }

  //Get Leaderboard Per Room 
  @Get(':id/leaderboard')
  @ApiOperation({ summary: 'Get leaderboard for a room' })
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: [
        { id: 'player-id-1', name: 'Player 1', score: 1500, isReady: true },
        { id: 'player-id-2', name: 'Player 2', score: 1200, isReady: false },
      ],
    },
  })    
  async getRoomLeaderboard(@Param('id') id: string): Promise<Player[]> {
    return await this.roomService.getRoomLeaderboard(id);
  }
}
