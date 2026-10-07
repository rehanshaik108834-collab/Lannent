import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { AuditRequestsService } from './audit-requests.service';
import { CreateAuditRequestDto } from './dto/create-audit-request.dto';
import { UpdateAuditRequestDto } from './dto/update-audit-request.dto';
import { CreateOfferDto, AcceptAuditDto, DeclineAuditDto } from './dto/audit-offer.dto';
import { RoleGuard } from '../../common/guards/role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/decorators/current-actor.decorator';

@ApiTags('Audit Requests')
@Controller('audit-requests')
@UseGuards(RoleGuard)
export class AuditRequestsController {
  constructor(private readonly auditRequestsService: AuditRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'Audit engagements you are party to (supports ?expertId=&status=&taskId=&kind=)' })
  @ApiQuery({ name: 'expertId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'taskId', required: false })
  @ApiQuery({ name: 'kind', required: false, enum: ['project-audit', 'dispute-audit'] })
  findAll(
    @CurrentActor() actor: Actor,
    @Query('expertId') expertId?: string,
    @Query('status') status?: string,
    @Query('taskId') taskId?: string,
    @Query('kind') kind?: string,
  ) {
    return this.auditRequestsService.findAll({ expertId, status, taskId, kind }, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an audit engagement you are party to' })
  findOne(@Param('id') id: string, @CurrentActor() actor: Actor) {
    return this.auditRequestsService.findById(id, actor);
  }

  @Get(':id/preview')
  @ApiBearerAuth()
  @Roles('expert', 'client', 'superuser', 'compliance-admin')
  @ApiOperation({
    summary: 'Preview the work before accepting',
    description: 'Project, milestones, client, worker and — for a dispute audit — the claim itself.',
  })
  preview(@Param('id') id: string, @CurrentActor() actor: Actor) {
    return this.auditRequestsService.preview(id, actor);
  }

  @Post()
  @ApiBearerAuth()
  @Roles('client')
  @ApiOperation({ summary: 'Request a technical audit of your project' })
  create(@Body() dto: CreateAuditRequestDto, @CurrentActor() actor: Actor) {
    return this.auditRequestsService.createFor(dto, actor);
  }

  @Post(':id/offers')
  @ApiBearerAuth()
  @Roles('client', 'expert')
  @ApiOperation({ summary: 'Make or counter an offer for the audit fee (client or assigned reviewer)' })
  addOffer(@Param('id') id: string, @Body() dto: CreateOfferDto, @CurrentActor() actor: Actor) {
    return this.auditRequestsService.addOfferFor(id, dto, actor);
  }

  @Post(':id/offers/:offerId/accept')
  @ApiBearerAuth()
  @Roles('client', 'expert')
  @ApiOperation({ summary: "Accept the other side's offer, fixing the agreed fee" })
  acceptOffer(@Param('id') id: string, @Param('offerId') offerId: string, @CurrentActor() actor: Actor) {
    return this.auditRequestsService.acceptOfferFor(id, offerId, actor);
  }

  @Post(':id/fund')
  @ApiBearerAuth()
  @Roles('client')
  @ApiOperation({ summary: "Move the agreed fee into escrow (the project's client)" })
  fund(@Param('id') id: string, @CurrentActor() actor: Actor) {
    return this.auditRequestsService.fundFor(id, actor);
  }

  @Post(':id/accept')
  @ApiBearerAuth()
  @Roles('expert')
  @ApiOperation({
    summary: 'Take the engagement (assigned or eligible reviewer)',
    description: 'For a project audit this also releases the project from draft.',
  })
  accept(@Param('id') id: string, @Body() dto: AcceptAuditDto, @CurrentActor() actor: Actor) {
    return this.auditRequestsService.acceptFor(id, dto, actor);
  }

  @Post(':id/decline')
  @ApiBearerAuth()
  @Roles('expert')
  @ApiOperation({ summary: 'Pass on the engagement (assigned reviewer)' })
  decline(@Param('id') id: string, @Body() dto: DeclineAuditDto, @CurrentActor() actor: Actor) {
    return this.auditRequestsService.declineFor(id, dto, actor);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles('client', 'expert')
  @ApiOperation({ summary: 'Edit descriptive fields of an engagement you are party to' })
  update(@Param('id') id: string, @Body() dto: UpdateAuditRequestDto, @CurrentActor() actor: Actor) {
    return this.auditRequestsService.updateFor(id, dto, actor);
  }
}
