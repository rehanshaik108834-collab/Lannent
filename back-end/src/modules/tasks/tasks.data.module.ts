import { Module } from '@nestjs/common';
import { TasksRepository } from './tasks.repository';

/** Leaf storage module: imports no workflows or HTTP modules. */
@Module({ providers: [TasksRepository], exports: [TasksRepository] })
export class TasksDataModule {}
