import { IsIn, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResolveDisputeDto {
  /** Optional and redundant: the reviewer is the signed-in actor. A mismatch is rejected. */
  @ApiPropertyOptional({ example: 'u3' })
  @IsOptional() @IsString()
  expertId?: string;

  @ApiProperty({ example: 'worker-favour', enum: ['worker-favour', 'client-favour', 'split'] })
  @IsIn(['worker-favour', 'client-favour', 'split'])
  verdict: string;

  @ApiProperty({ example: 'After review, milestone is complete. Releasing escrow.' })
  @IsString()
  resolution: string;
}
