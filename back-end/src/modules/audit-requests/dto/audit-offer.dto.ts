import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOfferDto {
  @ApiProperty({ example: 300, description: 'Proposed fee for the audit, in USD' })
  @IsNumber() @Min(1)
  amount: number;

  @ApiProperty({ example: 'client', enum: ['client', 'expert'] })
  /** Optional and redundant: your side is derived from your account. A mismatch is rejected. */
  @IsOptional() @IsString()
  offeredBy?: string;

  @ApiPropertyOptional({ example: 'Covers the payment flow and the auth model.' })
  @IsOptional() @IsString()
  note?: string;
}

export class AcceptAuditDto {
  @ApiProperty({ example: 'u3', description: 'Expert taking the engagement' })
  /** Optional and redundant: the reviewer is the signed-in account. A mismatch is rejected. */
  @IsOptional() @IsString()
  expertId?: string;
}

export class DeclineAuditDto {
  @ApiPropertyOptional({ example: 'Outside my domain.' })
  @IsOptional() @IsString()
  reason?: string;
}
