import { Module } from '@nestjs/common';
import { ProposalsRepository } from './proposals.repository';

/** Leaf storage module: imports no workflows or HTTP modules. */
@Module({ providers: [ProposalsRepository], exports: [ProposalsRepository] })
export class ProposalsDataModule {}
