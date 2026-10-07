import { Module } from '@nestjs/common';
import { MessagesRepository } from './messages.repository';

/** Leaf storage module: imports no workflows or HTTP modules. */
@Module({ providers: [MessagesRepository], exports: [MessagesRepository] })
export class MessagesDataModule {}
