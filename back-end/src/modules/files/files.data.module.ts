import { Module } from '@nestjs/common';
import { FilesRepository } from './files.repository';

/** Leaf storage module: imports no workflows or HTTP modules. */
@Module({ providers: [FilesRepository], exports: [FilesRepository] })
export class FilesDataModule {}
