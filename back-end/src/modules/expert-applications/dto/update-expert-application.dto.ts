import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateExpertApplicationStatusDto {
  @ApiProperty({ example: 'approved', enum: ['approved', 'rejected'] })
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  /** Optional and redundant: the reviewer is the signed-in intake admin. A mismatch is rejected. */
  @ApiPropertyOptional({ example: 'u12' })
  @IsOptional()
  @IsString()
  reviewedBy?: string;
}
