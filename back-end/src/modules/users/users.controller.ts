import {
  ForbiddenException,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AccountDeletionGuard } from './account-deletion.guard';
import { UsersService } from './users.service';
import { LedgerService } from '../ledger/ledger.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, UpdateUserStatusDto } from './dto/update-user.dto';
import { WalletDto } from './dto/wallet.dto';
import { RoleGuard } from '../../common/guards/role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { canMoveAnyWallet } from '../../common/guards/viewer.util';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/decorators/current-actor.decorator';
import { projectUserFor } from './users.projections';

@ApiTags('Users')
@Controller('users')
@UseGuards(RoleGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly ledger: LedgerService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List users',
    description:
      'Other accounts appear as directory entries without email or balance.',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    description: 'Filter by role (client, worker, expert, superuser)',
  })
  findAll(@CurrentActor() actor: Actor, @Query('role') role?: string) {
    const all = this.usersService.findAll();
    return (role ? all.filter((u) => u.role === role) : all).map((u) =>
      projectUserFor(u, actor),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a user (directory entry unless it is your own account)',
  })
  findOne(@Param('id') id: string, @CurrentActor() actor: Actor) {
    return projectUserFor(this.usersService.findById(id), actor);
  }

  @Post('staff')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiBearerAuth()
  @Roles('superuser')
  @ApiOperation({
    summary: 'Create any user type including staff/admin (superuser only)',
  })
  createStaff(@Body() dto: CreateUserDto) {
    return redact(this.usersService.createPrivileged(dto));
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Register a new user' })
  create(@Body() dto: CreateUserDto) {
    return redact(this.usersService.create(dto));
  }

  @Patch(':id')
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
  @ApiOperation({
    summary: 'Update your own profile',
    description:
      'Identity, status, balance and reputation fields are rejected if changed.',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentActor() actor: Actor,
  ) {
    return redact(this.usersService.updateProfile(id, dto, actor));
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @Roles('superuser')
  @ApiOperation({ summary: 'Activate or suspend an account (operations only)' })
  setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentActor() actor: Actor,
  ) {
    return redact(this.usersService.setStatus(id, dto.status, actor));
  }

  @Delete(':id')
  @UseGuards(AccountDeletionGuard)
  @ApiBearerAuth()
  @Roles('superuser')
  @ApiOperation({ summary: 'Delete a user (superuser only)' })
  remove(@Param('id') id: string, @CurrentActor() actor: Actor) {
    return this.usersService.deleteAccount(id, actor);
  }

  @Post(':id/wallet/add')
  @ApiBearerAuth()
  @Roles('client', 'worker', 'expert', 'superuser')
  @ApiOperation({
    summary: 'Deposit funds into a wallet (card processing fee applies)',
    description:
      'Charges the deposit processing fee and credits the net. Returns the fee breakdown.',
  })
  addToWallet(
    @Param('id') id: string,
    @Body() dto: WalletDto,
    @CurrentActor() actor: Actor,
  ) {
    assertOwnWallet(id, actor);
    return this.ledger.deposit(id, dto.amount);
  }

  // There is deliberately no "deduct" route. Balances leave a wallet only
  // through ledger operations (withdrawal, escrow funding), which record the
  // matching transaction and fee.

  @Post(':id/wallet/withdraw')
  @ApiBearerAuth()
  @Roles('client', 'worker', 'expert', 'superuser')
  @ApiOperation({
    summary: 'Withdraw to an external account (payout fee applies)',
    description:
      'Debits the full gross amount and returns the fee breakdown and net paid out.',
  })
  withdraw(
    @Param('id') id: string,
    @Body() dto: WalletDto,
    @CurrentActor() actor: Actor,
  ) {
    assertOwnWallet(id, actor);
    return this.ledger.withdraw(id, dto.amount);
  }
}

/**
 * Strips the password on the way out.
 *
 * `GET /api/users` was returning all eleven records with the plaintext
 * password to any caller with any role header. Redacting here rather than in
 * the service is deliberate: internal callers hold the raw record and mutate
 * it, so handing them a copy would silently drop their writes.
 */
function redact<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => redact(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const { password, ...safe } = value as any;
    return safe as T;
  }
  return value;
}

/**
 * A wallet belongs to one person.
 *
 * These three routes took the user id from the **URL** and never compared it
 * to the caller. `@Roles` checked that the caller had *a* role, not that the
 * wallet was theirs — so any signed-in worker could withdraw from anyone's
 * balance. Proven before this check existed: u2 withdrew $250 from u5.
 *
 * Authentication alone does not close this: a valid token for u2 still names
 * u5 in the path. The comparison has to happen here.
 */
function assertOwnWallet(walletUserId: string, actor: Actor) {
  if (canMoveAnyWallet(actor.role)) return;
  if (actor.id !== walletUserId) {
    throw new ForbiddenException(
      'You can only move money in and out of your own wallet.',
    );
  }
}
