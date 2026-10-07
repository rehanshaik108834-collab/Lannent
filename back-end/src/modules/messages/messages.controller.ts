import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { RoleGuard } from '../../common/guards/role.guard';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/decorators/current-actor.decorator';

@ApiTags('Messages')
@Controller('messages')
@UseGuards(RoleGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @ApiOperation({ summary: 'Your conversations (supports ?taskId= and ?userId= to narrow them)' })
  @ApiQuery({ name: 'taskId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  findAll(@CurrentActor() actor: Actor, @Query('taskId') taskId?: string, @Query('userId') userId?: string) {
    return this.messagesService.findAllFor(actor, { taskId, userId });
  }

  @Post()
  @ApiOperation({ summary: 'Send a message to another participant of a project' })
  create(@Body() dto: CreateMessageDto, @CurrentActor() actor: Actor) {
    return this.messagesService.create(dto, actor);
  }
}
