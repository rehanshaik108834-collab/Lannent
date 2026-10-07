import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDisputeDto {
  @ApiProperty({ example: 't1' })
  @IsString()
  taskId: string;

  @ApiPropertyOptional({ example: 'm3' })
  @IsOptional() @IsString()
  milestoneId?: string;

  @ApiPropertyOptional({ example: 'u1' })
  /** Optional and redundant: derived from the signed-in party. A mismatch is rejected. */
  @IsOptional() @IsString()
  raisedBy?: string;

  @ApiPropertyOptional({ example: 'James Client' })
  @IsOptional() @IsString()
  raisedByName?: string;

  @ApiPropertyOptional({ example: 'u5' })
  /** Optional and redundant: derived from the signed-in party. A mismatch is rejected. */
  @IsOptional() @IsString()
  againstId?: string;

  @ApiPropertyOptional({ example: 'Sarah Johnson' })
  @IsOptional() @IsString()
  againstName?: string;

  @ApiProperty({ example: 'Backend integration incomplete' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ example: '₹500.00' })
  @IsOptional() @IsString()
  amount?: string;

  @ApiPropertyOptional({ example: 'E-commerce Website Redesign' })
  @IsOptional() @IsString()
  project?: string;

  @ApiPropertyOptional({ example: 'Backend Integration' })
  @IsOptional() @IsString()
  milestone?: string;

  @ApiPropertyOptional({ example: 'u3', description: 'The Expert Reviewer the client selected to arbitrate' })
  @IsOptional() @IsString()
  expertId?: string;
}
