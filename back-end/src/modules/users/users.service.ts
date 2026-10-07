import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, PROTECTED_PROFILE_FIELDS } from './dto/update-user.dto';
import { stripUnchangedProtectedFields } from '../../common/policies/protected-fields';
import {
  BASE_PROFILE_FIELDS,
  INTERNAL_SUB_FIELDS,
  ROLE_PROFILE_FIELDS,
  assertProfileFieldsFor,
} from './profile-contract';
import type { Actor } from '../../common/decorators/current-actor.decorator';
import { ROLES } from '../../common/constants/roles';
import { UsersRepository } from './users.repository';
import { round2 } from '../ledger/fee-config';
import { SELF_SERVICE_ROLES } from '../../common/constants/roles';
import { hashPassword, verifyPassword } from '../../common/security/password.util';

/**
 * EER Specialization — Users Service
 *
 * Handles business logic (validation, error handling, avatar generation).
 * Delegates all data-access operations to UsersRepository.
 * The API response shape is IDENTICAL to the old monolithic approach.
 */
@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  // ── Public API (returns merged/flat objects) ──────────────────────────────

  findAll() {
    return this.usersRepository.findAll();
  }

  findById(id: string) {
    const user = this.usersRepository.findById(id);
    if (!user) throw new NotFoundException(`User with id "${id}" not found`);
    return user;
  }

  findByEmail(email: string) {
    return this.usersRepository.findByEmail(email);
  }

  login(email: string, password: string) {
    const user = this.findByEmail(email);
    if (!user) throw new NotFoundException('No account found with this email address.');
    if (!verifyPassword(password, user.password)) {
      throw new BadRequestException('Incorrect password. Please try again.');
    }
    if (user.status === 'suspended') throw new BadRequestException('This account has been suspended. Contact support.');

    const session = {
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      avatarColor: user.avatarColor,
    };
    return { user, session };
  }

  /**
   * Public signup.
   *
   * `SELF_SERVICE_ROLES` existed and was never enforced: the DTO validated
   * `role` against every role in the system and this endpoint has no guard, so
   * an anonymous caller could POST `role: "admin"` and get a working admin
   * account. Staff are created by seeding or by another staff member — never
   * here. `createStaff()` is the deliberate path.
   */
  create(dto: CreateUserDto) {
    if (!SELF_SERVICE_ROLES.includes(dto.role as any)) {
      throw new ForbiddenException(
        `You cannot sign up as "${dto.role}". Public signup is for ${SELF_SERVICE_ROLES.join(' and ')} accounts.`,
      );
    }
    return this.insertUser(dto);
  }

  /**
   * Account creation on behalf of an authorised actor rather than public
   * signup — the seeder, a staff member, and the Expert Reviewer intake, which
   * creates the reviewer's account when an admin approves their application.
   * Skips the self-service role restriction; the caller is responsible for
   * having checked authority.
   */
  createPrivileged(dto: CreateUserDto) {
    return this.insertUser(dto);
  }

  /**
   * Creates the expert account for an approved application, with the password
   * the applicant chose (already hashed when they applied). There is no
   * default password: an application without one cannot become an account.
   */
  createExpertFromApplication(app: {
    name: string;
    email: string;
    passwordHash: string;
    specialization?: string;
  }) {
    if (!app.passwordHash) {
      throw new BadRequestException('The application has no chosen password; no account was created.');
    }
    return this.insertUser(
      { name: app.name, email: app.email, password: '', role: 'expert', specialization: app.specialization },
      app.passwordHash,
    );
  }

  private insertUser(dto: CreateUserDto, passwordHash?: string) {
    const existing = this.findByEmail(dto.email);
    if (existing) throw new BadRequestException('A user with this email already exists.');

    const initials = dto.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const colors = [
      'linear-gradient(135deg,#6366f1,#4f46e5)',
      'linear-gradient(135deg,#10b981,#059669)',
      'linear-gradient(135deg,#a855f7,#7c3aed)',
      'linear-gradient(135deg,#ec4899,#be185d)',
    ];

    const id = this.usersRepository.generateId();

    // ── Insert into base USERS table ────────────────────────────────────
    const baseUser: any = {
      id,
      name: dto.name,
      email: dto.email,
      password: passwordHash ?? hashPassword(dto.password),
      role: dto.role,
      avatar: dto.avatar || initials,
      avatarColor: dto.avatarColor || colors[Math.floor(Math.random() * colors.length)],
      status: 'active',
      joinDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      walletBalance: 0,
    };
    this.usersRepository.insertBase(baseUser);

    // ── Insert into role-specific sub-table ──────────────────────────────
    if (dto.role === 'client') {
      this.usersRepository.insertClient({
        userId: id,
        company: dto.company || '',
        location: dto.location || '',
      });
    } else if (dto.role === 'worker') {
      this.usersRepository.insertWorker({
        userId: id,
        location: dto.location || '',
        skills: dto.skills || [],
        rating: 0,
        completedProjects: 0,
      });
    } else if (dto.role === 'expert') {
      this.usersRepository.insertExpert({
        userId: id,
        specialization: dto.specialization || '',
        reviewsDone: 0,
      });
    }

    // Return merged flat object (same shape as before)
    return this.usersRepository.findById(id);
  }

  /**
   * Self-service profile edit. The account holder edits their own profile;
   * operations may correct another account's profile fields. Identity,
   * status, balances and reputation counters cannot change here.
   */
  updateProfile(id: string, dto: UpdateUserDto, actor: Actor) {
    if (actor.id !== id && actor.role !== ROLES.SUPERUSER) {
      throw new ForbiddenException('You can only edit your own profile.');
    }
    const existing = this.findById(id);
    const changes: Record<string, unknown> = stripUnchangedProtectedFields(
      dto, existing, PROTECTED_PROFILE_FIELDS,
      (field) => `"${field}" cannot be changed through a profile update.`,
    );
    assertProfileFieldsFor(existing.role, changes);
    // The company name shown in directories follows the company details.
    const details = changes.companyDetails as { name?: string } | undefined;
    if (details?.name !== undefined && changes.company === undefined) changes.company = details.name;
    return this.update(id, changes);
  }

  /** Operations-only account status change. An operator cannot suspend themselves. */
  setStatus(id: string, status: 'active' | 'suspended', actor: Actor) {
    if (actor.role !== ROLES.SUPERUSER) {
      throw new ForbiddenException('Only operations can change an account\'s status.');
    }
    if (actor.id === id) throw new BadRequestException('You cannot change your own account status.');
    this.findById(id);
    return this.update(id, { status });
  }

  /** Operations-only deletion. An operator cannot delete their own account. */
  deleteAccount(id: string, actor: Actor) {
    if (actor.id === id) throw new BadRequestException('You cannot delete your own account.');
    return this.delete(id);
  }

  /**
   * Internal write used by trusted services (e.g. reputation counters after a
   * paid audit) and by the operations methods above. Never wire this directly
   * to a request body.
   */
  update(id: string, dto: Record<string, any>) {
    const base = this.usersRepository.getRawBase(id);
    if (!base) throw new NotFoundException(`User with id "${id}" not found`);

    // Base fields go on the account; role fields and platform counters go on
    // the role's profile record. Identity, credentials and the balance are
    // never written here: email/role/password have no update path, and only
    // addToWallet/deductFromWallet (called by LedgerService) move a balance.
    const baseFields: string[] = [...BASE_PROFILE_FIELDS, 'status'];
    const roleFields: string[] = [...(ROLE_PROFILE_FIELDS[base.role] ?? []), ...INTERNAL_SUB_FIELDS];
    const baseUpdates: Record<string, unknown> = {};
    const subUpdates: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(dto)) {
      if (value === undefined) continue;
      if (baseFields.includes(field)) baseUpdates[field] = value;
      else if (roleFields.includes(field)) subUpdates[field] = value;
    }
    this.usersRepository.updateBase(id, baseUpdates);

    if (Object.keys(subUpdates).length && ROLE_PROFILE_FIELDS[base.role]) {
      let sub = this.usersRepository.subFor(base);
      if (!sub) {
        const fresh = { userId: id };
        if (base.role === 'client') this.usersRepository.insertClient(fresh);
        if (base.role === 'worker') this.usersRepository.insertWorker(fresh);
        if (base.role === 'expert') this.usersRepository.insertExpert(fresh);
        sub = this.usersRepository.subFor(base);
      }
      if (!sub) throw new Error(`Could not create the ${base.role} profile for ${id}.`);
      Object.assign(sub, subUpdates);
    }

    return this.usersRepository.findById(id);
  }

  delete(id: string) {
    const deleted = this.usersRepository.deleteById(id);
    if (!deleted) throw new NotFoundException(`User with id "${id}" not found`);
    return { deleted: true };
  }

  // Balances are rounded to cents on every write. Without this, repeated
  // float arithmetic drifts (24500 - 2634.99 lands on 21865.010000000002)
  // and balances stop comparing equal to the amounts that produced them.
  deductFromWallet(id: string, amount: number) {
    const base = this.usersRepository.getRawBase(id);
    if (!base) throw new NotFoundException(`User with id "${id}" not found`);
    if (base.walletBalance < amount) throw new BadRequestException('Insufficient wallet balance.');
    base.walletBalance = round2(base.walletBalance - amount);
    return this.usersRepository.findById(id);
  }

  addToWallet(id: string, amount: number) {
    const base = this.usersRepository.getRawBase(id);
    if (!base) throw new NotFoundException(`User with id "${id}" not found`);
    base.walletBalance = round2(base.walletBalance + amount);
    return this.usersRepository.findById(id);
  }

  // ── Reset all data to seed ────────────────────────────────────────────────
  resetToSeed() {
    this.usersRepository.resetToSeed();
  }
}
