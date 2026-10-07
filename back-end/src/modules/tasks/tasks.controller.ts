import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { RequestTerminationDto } from './dto/request-termination.dto';
import { ProjectTerminationService } from '../termination/project-termination.service';
import { RoleGuard } from '../../common/guards/role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/decorators/current-actor.decorator';

@ApiTags('Tasks')
@Controller('tasks')
@UseGuards(RoleGuard)
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly termination: ProjectTerminationService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List projects you may see',
    description: 'Open projects are discoverable; others are visible to their parties, engaged reviewers and oversight.',
  })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'workerId', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(
    @CurrentActor() actor: Actor,
    @Query('clientId') clientId?: string,
    @Query('workerId') workerId?: string,
    @Query('status') status?: string,
  ) {
    return this.tasksService.findAllFor(actor, { clientId, workerId, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project you may see' })
  findOne(@Param('id') id: string, @CurrentActor() actor: Actor) {
    return this.tasksService.findByIdFor(id, actor);
  }

  @Post()
  @ApiBearerAuth()
  @Roles('client')
  @ApiOperation({ summary: 'Create a project for the signed-in client (INR)' })
  create(@Body() dto: CreateTaskDto, @CurrentActor() actor: Actor) {
    return this.tasksService.createFor(dto, actor);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles('client')
  @ApiOperation({ summary: 'Edit project details (owning client; status and assignment are not editable)' })
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @CurrentActor() actor: Actor) {
    return this.tasksService.updateByOwner(id, dto, actor);
  }

  @Post(':id/cancel-draft')
  @ApiBearerAuth()
  @Roles('client')
  @ApiOperation({
    summary: 'Abandon a draft project',
    description: 'Cancels a project still awaiting its technical audit and refunds any audit escrow.',
  })
  cancelDraft(@Param('id') id: string, @CurrentActor() actor: Actor) {
    return this.tasksService.cancelDraft(id, actor);
  }

  @Post(':id/termination')
  @ApiBearerAuth()
  @Roles('client', 'worker')
  @ApiOperation({
    summary: 'Ask to end the contract (client or hired worker)',
    description:
      'Blocks new work. Finalizes once no submitted milestone or open dispute remains: unfinished milestones are cancelled, held project escrow and unpaid audit escrow return to the client. Otherwise returns the blockers.',
  })
  requestTermination(@Param('id') id: string, @Body() dto: RequestTerminationDto, @CurrentActor() actor: Actor) {
    const status = this.termination.request(id, dto.reason, actor);
    return status.state === 'pending'
      ? {
          state: 'pending',
          blockingMilestoneIds: status.blockingMilestoneIds,
          activeDisputeIds: status.activeDisputeIds,
          task: status.task,
        }
      : { state: 'finalized', termination: status.termination, task: status.task };
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('client', 'superuser')
  @ApiOperation({
    summary: 'Delete a project that never started',
    description: 'Only open, unassigned projects holding no money. Nothing is refunded because nothing was paid.',
  })
  remove(@Param('id') id: string, @CurrentActor() actor: Actor) {
    return this.tasksService.deleteFor(id, actor);
  }
}
