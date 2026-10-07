import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { LedgerService } from './ledger.service';
import { RoleGuard } from '../../common/guards/role.guard';
import { Roles } from '../../common/decorators/roles.decorator';

import { TasksAccessService } from '../tasks/tasks-access.service';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/decorators/current-actor.decorator';
/**
 * Read-only view of escrow and platform revenue.
 *
 * Deliberately minimal — the Admin revenue dashboard and its aggregations are
 * built on top of this in a later phase.
 */
@ApiTags('Ledger')
@Controller('ledger')
@UseGuards(RoleGuard)
export class LedgerController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly tasks: TasksAccessService,
  ) {}

  @Get('summary')
  @ApiBearerAuth()
  // The authoritative financial state. The revenue desk needs it to reconcile
  // the model it owns — every /revenue figure is derived from these totals, so
  // granting the derived view while withholding the source would leave that
  // desk unable to check its own numbers.
  @Roles('superuser', 'revenue-admin', 'compliance-admin')
  @ApiOperation({ summary: 'Escrow held and platform revenue totals' })
  summary() {
    return {
      totalHeld: this.ledger.totalHeld(),
      totalRevenue: this.ledger.totalRevenue(),
      escrowByTask: this.ledger.allEscrow(),
      revenueEntries: this.ledger.getRevenue(),
    };
  }

  @Get('escrow/:taskId')
  @ApiBearerAuth()
  @Roles(
    'client',
    'worker',
    'expert',
    'superuser',
    'revenue-admin',
    'intake-admin',
    'compliance-admin',
  )
  @ApiOperation({ summary: 'Escrow held for one project you may see' })
  escrow(@Param('taskId') taskId: string, @CurrentActor() actor: Actor) {
    // Same rule as reading the project itself: its parties, engaged reviewers
    // and oversight. An open project holds nothing until someone is hired.
    this.tasks.findByIdFor(taskId, actor);
    return this.ledger.getEscrow(taskId);
  }
}
