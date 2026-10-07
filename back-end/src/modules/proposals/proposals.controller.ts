import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { ProposalsService } from './proposals.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { RoleGuard } from '../../common/guards/role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/decorators/current-actor.decorator';

@ApiTags('Proposals')
@Controller('proposals')
@UseGuards(RoleGuard)
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Get()
  @ApiOperation({ summary: 'List proposals and invitations you are party to (supports ?taskId=&workerId=&type=)' })
  @ApiQuery({ name: 'taskId', required: false })
  @ApiQuery({ name: 'workerId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: ['proposal', 'invitation'] })
  findAll(
    @CurrentActor() actor: Actor,
    @Query('taskId') taskId?: string,
    @Query('workerId') workerId?: string,
    @Query('type') type?: string,
  ) {
    return this.proposalsService.findAllFor(actor, { taskId, workerId, type });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a proposal you are party to' })
  findOne(@Param('id') id: string, @CurrentActor() actor: Actor) {
    return this.proposalsService.findByIdFor(id, actor);
  }

  @Post()
  @ApiBearerAuth()
  @Roles('worker', 'client')
  @ApiOperation({ summary: 'Submit a proposal (worker) or invite a worker (owning client)' })
  create(@Body() dto: CreateProposalDto, @CurrentActor() actor: Actor) {
    return this.proposalsService.create(dto, actor);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles('worker', 'client')
  @ApiOperation({ summary: 'Withdraw your proposal (worker) or reject one / withdraw an invitation (client)' })
  update(@Param('id') id: string, @Body() dto: UpdateProposalDto, @CurrentActor() actor: Actor) {
    return this.proposalsService.update(id, dto, actor);
  }

  @Post(':id/hire')
  @ApiBearerAuth()
  @Roles('client')
  @ApiOperation({ summary: 'Hire the worker behind a proposal (owning client; funds escrow)' })
  hire(@Param('id') id: string, @CurrentActor() actor: Actor) {
    return this.proposalsService.hireWorker(id, actor);
  }

  @Post(':id/accept')
  @ApiBearerAuth()
  @Roles('worker')
  @ApiOperation({ summary: "Accept your invitation (funds escrow from the client's wallet)" })
  accept(@Param('id') id: string, @CurrentActor() actor: Actor) {
    return this.proposalsService.acceptInvitation(id, actor);
  }

  @Post(':id/decline')
  @ApiBearerAuth()
  @Roles('worker')
  @ApiOperation({ summary: 'Decline your invitation' })
  decline(@Param('id') id: string, @CurrentActor() actor: Actor) {
    return this.proposalsService.declineInvitation(id, actor);
  }
}
