import {
  ArrayMaxSize,
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  IsIn,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** A milestone created together with its project. */
export class InitialMilestoneDto {
  @ApiProperty({ example: 'Wireframes' })
  @IsString() @MinLength(2) @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'Low-fidelity wireframes for every page' })
  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 800, description: 'INR, at most two decimals' })
  @IsNumber() @Min(0.01)
  budget: number;

  @ApiPropertyOptional({ example: '2026-11-15' })
  @IsOptional() @IsString()
  dueDate?: string;
}

export class CreateTaskDto {
  /**
   * Initial milestones, created in the same operation as the project. When
   * given, their budgets must add up exactly to the project budget.
   */
  @ApiPropertyOptional({ type: [InitialMilestoneDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(50)
  @ValidateNested({ each: true }) @Type(() => InitialMilestoneDto)
  milestones?: InitialMilestoneDto[];

  @ApiProperty({ example: 'E-commerce Website Redesign' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Need a complete redesign of our platform' })
  @IsString()
  description: string;

  @ApiProperty({ example: 'Web Development' })
  @IsString()
  category: string;

  @ApiProperty({ example: 2500 })
  @IsNumber()
  @Min(1)
  budget: number;

  @ApiPropertyOptional({ example: 'INR', enum: ['INR'], description: 'INR only; other currencies are rejected.' })
  @IsOptional() @IsIn(['INR'], { message: 'Lannent uses INR only.' })
  currency?: string;

  @ApiPropertyOptional({ example: '2026-04-15' })
  @IsOptional() @IsString()
  deadline?: string;

  @ApiPropertyOptional({ example: ['React', 'Figma'] })
  @IsOptional() @IsArray()
  skills?: string[];

  /** Optional and redundant: the client is the signed-in actor. A mismatch is rejected. */
  @ApiPropertyOptional({ example: 'u1' })
  @IsOptional() @IsString()
  clientId?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional() @IsBoolean()
  auditEnabled?: boolean;

  @ApiPropertyOptional({ example: 300, description: 'Opening offer for the technical audit fee' })
  @IsOptional() @IsNumber()
  auditFee?: number;

  @ApiPropertyOptional({ example: 'Web Development', description: 'Expert domain the audit should match' })
  @IsOptional() @IsString()
  auditDomain?: string;

  @ApiPropertyOptional({ example: 'u3', description: 'The Expert Reviewer the client selected for the audit' })
  @IsOptional() @IsString()
  auditExpertId?: string;
}
