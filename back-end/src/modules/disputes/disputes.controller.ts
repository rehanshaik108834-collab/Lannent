import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { RoleGuard } from '../../common/guards/role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/decorators/current-actor.decorator';

@ApiTags('Disputes')
@Controller('disputes')
@UseGuards(RoleGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  @ApiOperation({ summary: 'Disputes you are party to or arbitrating' })
  findAll(@CurrentActor() actor: Actor) {
    return this.disputesService.findAll(actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a dispute you are party to or arbitrating' })
  findOne(@Param('id') id: string, @CurrentActor() actor: Actor) {
    return this.disputesService.findById(id, actor);
  }

  @Post()
  @ApiBearerAuth()
  @Roles('client', 'worker')
  @ApiOperation({ summary: 'Dispute a milestone of your project (client or hired worker)' })
  create(@Body() dto: CreateDisputeDto, @CurrentActor() actor: Actor) {
    return this.disputesService.create(dto, actor);
  }

  @Post(':id/resolve')
  @ApiBearerAuth()
  @Roles('expert')
  @ApiOperation({ summary: 'Give the verdict on a dispute and settle its milestone (assigned reviewer only)' })
  resolve(@Param('id') id: string, @Body() dto: ResolveDisputeDto, @CurrentActor() actor: Actor) {
    return this.disputesService.resolve(id, dto, actor);
  }
}
