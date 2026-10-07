import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** `POST /tasks/:id/termination` */
export class RequestTerminationDto {
  @ApiProperty({ example: 'The worker has stopped responding.' })
  @IsString() @MinLength(10) @MaxLength(1000)
  reason: string;
}
