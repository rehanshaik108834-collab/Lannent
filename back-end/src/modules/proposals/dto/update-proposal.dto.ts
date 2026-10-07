import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Closing a pending proposal or invitation. Hiring, accepting and declining
 * have their own actions; other fields of a submitted proposal do not change.
 */
export class UpdateProposalDto {
  @ApiProperty({ example: 'withdrawn', enum: ['withdrawn', 'rejected'] })
  @IsIn(['withdrawn', 'rejected'])
  status: 'withdrawn' | 'rejected';
}
