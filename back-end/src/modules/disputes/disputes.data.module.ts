import { Module } from '@nestjs/common';
import { DisputesRepository } from './disputes.repository';

/** Leaf storage module: imports no workflows or HTTP modules. */
@Module({ providers: [DisputesRepository], exports: [DisputesRepository] })
export class DisputesDataModule {}
