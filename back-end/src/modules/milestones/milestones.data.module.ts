import { Module } from '@nestjs/common';
import { MilestonesRepository } from './milestones.repository';

/** Leaf storage module: imports no workflows or HTTP modules. */
@Module({ providers: [MilestonesRepository], exports: [MilestonesRepository] })
export class MilestonesDataModule {}
