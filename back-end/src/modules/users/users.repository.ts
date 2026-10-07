import type {
  UserBase,
  UserRecord,
  ClientProfile,
  WorkerProfile,
  ExpertProfile,
} from './users.types';
import { Injectable } from '@nestjs/common';
import {
  SEED_USERS,
  SEED_CLIENTS,
  SEED_WORKERS,
  SEED_EXPERTS,
} from '../seed/seed.data';
import { hashPassword } from '../../common/security/password.util';

/**
 * UsersRepository — In-Memory Data Access Layer
 *
 * Manages the four EER sub-tables (USERS, CLIENTS, WORKERS, EXPERTS)
 * and provides low-level CRUD operations on the in-memory arrays.
 * Business logic (validation, error throwing) belongs in UsersService.
 */
@Injectable()
export class UsersRepository {
  private users: UserBase[] = hashSeed(SEED_USERS);
  private clients: ClientProfile[] = structuredClone(SEED_CLIENTS);
  private workers: WorkerProfile[] = structuredClone(SEED_WORKERS);
  private experts: ExpertProfile[] = structuredClone(SEED_EXPERTS);
  private counter = 100;

  generateId(): string {
    return 'u_' + Date.now() + '_' + this.counter++;
  }

  // ── Merge: base user + role-specific fields → flat object ─────────────────
  mergeUser(base: UserBase): UserRecord {
    // Every user has the same core shape regardless of role; role-specific
    // profile fields stored on the sub-table are layered on top.
    const merged: UserRecord = {
      company: '',
      location: '',
      skills: [],
      rating: 0,
      completedProjects: 0,
      specialization: '',
      reviewsDone: 0,
      domains: [],
      ...base,
    };
    const sub = this.subFor(base);
    if (sub) {
      const { userId: _userId, ...fields } = sub;
      Object.assign(merged, fields);
    }
    if (base.role === 'expert') merged.hourlyRate = merged.hourlyRate ?? 0;
    return merged;
  }

  /** The role-specific profile record, if the role has one. */
  subFor(base: UserBase): ClientProfile | WorkerProfile | ExpertProfile | null {
    if (base.role === 'client')
      return this.clients.find((c) => c.userId === base.id) || null;
    if (base.role === 'worker')
      return this.workers.find((w) => w.userId === base.id) || null;
    if (base.role === 'expert')
      return this.experts.find((e) => e.userId === base.id) || null;
    return null;
  }

  // ── CRUD Operations ───────────────────────────────────────────────────────

  findAll(): UserRecord[] {
    return this.users.map((u) => this.mergeUser(u));
  }

  findById(id: string): UserRecord | null {
    const base = this.users.find((u) => u.id === id);
    return base ? this.mergeUser(base) : null;
  }

  findByEmail(email: string): UserRecord | null {
    const base = this.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );
    return base ? this.mergeUser(base) : null;
  }

  insertBase(baseUser: UserBase): void {
    this.users.push(baseUser);
  }

  insertClient(sub: ClientProfile): void {
    this.clients.push(sub);
  }

  insertWorker(sub: WorkerProfile): void {
    this.workers.push(sub);
  }

  insertExpert(sub: ExpertProfile): void {
    this.experts.push(sub);
  }

  updateBase(id: string, partial: Partial<UserBase>): UserBase | null {
    const base = this.users.find((u) => u.id === id);
    if (!base) return null;
    Object.assign(base, partial);
    return base;
  }

  findClientSub(userId: string): ClientProfile | null {
    return this.clients.find((c) => c.userId === userId) || null;
  }

  findWorkerSub(userId: string): WorkerProfile | null {
    return this.workers.find((w) => w.userId === userId) || null;
  }

  findExpertSub(userId: string): ExpertProfile | null {
    return this.experts.find((e) => e.userId === userId) || null;
  }

  deleteById(id: string): boolean {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    this.users.splice(idx, 1);
    this.clients = this.clients.filter((c) => c.userId !== id);
    this.workers = this.workers.filter((w) => w.userId !== id);
    this.experts = this.experts.filter((e) => e.userId !== id);
    return true;
  }

  // ── Wallet Operations ────────────────────────────────────────────────────

  getRawBase(id: string): UserBase | null {
    return this.users.find((u) => u.id === id) || null;
  }

  // ── Reset to seed data ───────────────────────────────────────────────────

  resetToSeed(): void {
    this.users = hashSeed(SEED_USERS);
    this.clients = structuredClone(SEED_CLIENTS);
    this.workers = structuredClone(SEED_WORKERS);
    this.experts = structuredClone(SEED_EXPERTS);
  }
}

/**
 * Seed users ship with readable passwords so the documented demo logins are
 * usable. They are hashed on the way into the store, so nothing in a running
 * process ever holds a plaintext password — reset included.
 */
function hashSeed(seed: readonly UserBase[]): UserBase[] {
  return structuredClone(seed).map((u) => ({
    ...u,
    password: hashPassword(u.password),
  }));
}
