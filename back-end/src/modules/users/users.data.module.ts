import { Module } from '@nestjs/common';
import { UsersRepository } from './users.repository';

/** Leaf storage module: imports no workflows or HTTP modules. */
@Module({ providers: [UsersRepository], exports: [UsersRepository] })
export class UsersDataModule {}
