import { Controller, Get, Patch, Query, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { RoleGuard } from '../../common/guards/role.guard';
import { canViewAnyRecord } from '../../common/guards/viewer.util';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/decorators/current-actor.decorator';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(RoleGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Your notifications (oversight roles may pass ?userId=)' })
  @ApiQuery({ name: 'userId', required: false })
  findAll(@CurrentActor() actor: Actor, @Query('userId') userId?: string) {
    const target = userId || actor.id;
    if (target !== actor.id && !canViewAnyRecord(actor.role)) {
      throw new ForbiddenException('You can only read your own notifications.');
    }
    return this.notificationsService.findAll({ userId: target });
  }

  @Patch(':userId/read-all')
  @ApiOperation({ summary: 'Mark all of your notifications as read' })
  markAllRead(@Param('userId') userId: string, @CurrentActor() actor: Actor) {
    if (userId !== actor.id) {
      throw new ForbiddenException('You can only mark your own notifications as read.');
    }
    return this.notificationsService.markAllRead(userId);
  }
}
