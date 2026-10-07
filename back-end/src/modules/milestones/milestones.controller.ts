import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { MilestonesService } from './milestones.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto, SubmitDeliverableDto, RequestRevisionDto } from './dto/update-milestone.dto';
import { RoleGuard } from '../../common/guards/role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/decorators/current-actor.decorator';

@ApiTags('Milestones')
@Controller('milestones')
@UseGuards(RoleGuard)
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Get()
  @ApiOperation({ summary: 'List milestones of projects you may see (supports ?taskId=)' })
  @ApiQuery({ name: 'taskId', required: false })
  findAll(@CurrentActor() actor: Actor, @Query('taskId') taskId?: string) {
    return this.milestonesService.findAllFor(actor, { taskId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a milestone of a project you may see' })
  findOne(@Param('id') id: string, @CurrentActor() actor: Actor) {
    return this.milestonesService.findByIdFor(id, actor);
  }

  @Post()
  @ApiBearerAuth()
  @Roles('client')
  @ApiOperation({ summary: 'Add a milestone to your project' })
  create(@Body() dto: CreateMilestoneDto, @CurrentActor() actor: Actor) {
    return this.milestonesService.createFor(dto, actor);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles('client', 'worker')
  @ApiOperation({
    summary: 'Edit milestone details (client) or start work / report progress (assigned worker)',
  })
  update(@Param('id') id: string, @Body() dto: UpdateMilestoneDto, @CurrentActor() actor: Actor) {
    return this.milestonesService.updateFor(id, dto, actor);
  }

  @Post(':id/request-revision')
  @ApiBearerAuth()
  @Roles('client')
  @ApiOperation({ summary: 'Send submitted work back for changes (owning client; escrow stays held)' })
  requestRevision(@Param('id') id: string, @Body() dto: RequestRevisionDto, @CurrentActor() actor: Actor) {
    return this.milestonesService.requestRevision(id, dto.reason, actor);
  }

  @Post(':id/submit')
  @ApiBearerAuth()
  @Roles('worker')
  @ApiOperation({ summary: 'Submit deliverable for a milestone (assigned worker only)' })
  submit(@Param('id') id: string, @Body() dto: SubmitDeliverableDto, @CurrentActor() actor: Actor) {
    return this.milestonesService.submitDeliverable(id, dto.deliverable, actor);
  }

  @Post(':id/approve')
  @ApiBearerAuth()
  @Roles('client')
  @ApiOperation({
    summary: 'Approve submitted work and release escrow (owning client; needs the milestone report when audited)',
  })
  approve(@Param('id') id: string, @CurrentActor() actor: Actor) {
    return this.milestonesService.approveDeliverable(id, actor);
  }
}
