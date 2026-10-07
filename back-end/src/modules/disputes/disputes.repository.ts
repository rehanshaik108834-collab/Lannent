import type { DisputeRecord } from './disputes.types';
import { Injectable } from '@nestjs/common';
import { SEED_DISPUTES } from '../seed/seed.data';

/**
 * DisputesRepository — In-Memory Data Access Layer
 *
 * Manages the DISPUTES array and provides low-level CRUD operations.
 * Business logic (resolve, milestone updates) belongs in DisputesService.
 */
@Injectable()
export class DisputesRepository {
  private disputes: DisputeRecord[] = structuredClone(SEED_DISPUTES);
  private counter = 100;

  generateId(): string {
    return 'd_' + Date.now() + '_' + this.counter++;
  }

  findAll(): DisputeRecord[] {
    return this.disputes;
  }

  findById(id: string): DisputeRecord | null {
    return this.disputes.find((d) => d.id === id) || null;
  }

  insert(dispute: DisputeRecord): DisputeRecord {
    this.disputes.push(dispute);
    return dispute;
  }

  update(id: string, partial: Partial<DisputeRecord>): DisputeRecord | null {
    const dispute = this.disputes.find((d) => d.id === id);
    if (!dispute) return null;
    Object.assign(dispute, partial);
    return dispute;
  }

  resetToSeed(): void {
    this.disputes = structuredClone(SEED_DISPUTES);
  }
}
