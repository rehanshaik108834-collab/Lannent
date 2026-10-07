import { Controller, Get, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { RoleGuard } from '../../common/guards/role.guard';
import { canViewAnyRecord } from '../../common/guards/viewer.util';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/decorators/current-actor.decorator';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(RoleGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Your transaction history (oversight roles may pass ?userId= or omit it for all)',
  })
  @ApiQuery({ name: 'userId', required: false })
  findAll(@CurrentActor() actor: Actor, @Query('userId') userId?: string) {
    if (canViewAnyRecord(actor.role)) return this.transactionsService.findAll({ userId });
    if (userId && userId !== actor.id) {
      throw new ForbiddenException('You can only read your own transaction history.');
    }
    return this.transactionsService.findAll({ userId: actor.id });
  }

  // There is deliberately no POST. Transaction rows are written only by
  // LedgerService, alongside the money movement they record.
}
