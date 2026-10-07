import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import {
  Allow,
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AUDIT_DOMAIN_IDS } from '../profile-contract';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Self-service profile update (`PATCH /users/:id`).
 *
 * Only ordinary profile fields are editable here. The fields below the line
 * are declared so the server can *refuse* a change instead of silently
 * dropping it: identity fields (email, role, password) may be resent
 * unchanged by legacy forms but never changed here, and balances, status and
 * reputation counters are never writable through a profile update. Balances
 * move only through ledger operations; status moves through
 * `PATCH /users/:id/status`.
 */
export class CompanyDetailsDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(80) industry?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
  @IsOptional() @IsString() @MaxLength(40) size?: string;
  @IsOptional() @IsString() @MaxLength(120) location?: string;
}

export class PortfolioProjectDto {
  @IsString() @MaxLength(40) id: string;
  @IsString() @MaxLength(120) title: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(500) url?: string;
  @IsOptional() @IsString() @MaxLength(500) thumbnail?: string | null;
}

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['role', 'email', 'password'] as const),
) {
  // ── Profile fields (which ones a role may save: see profile-contract.ts) ──

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional() @IsString() @MaxLength(24) @Matches(/^[+\d\s()-]*$/, { message: 'phone may contain digits, spaces, +, - and brackets only.' })
  phone?: string;

  @ApiPropertyOptional({ example: '+91' })
  @IsOptional() @IsString() @MaxLength(6)
  phoneCountryCode?: string;

  @ApiPropertyOptional({ example: 'Full-stack developer focused on payments.' })
  @IsOptional() @IsString() @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({ type: CompanyDetailsDto, description: 'Clients only' })
  @IsOptional() @ValidateNested() @Type(() => CompanyDetailsDto)
  companyDetails?: CompanyDetailsDto;

  @ApiPropertyOptional({ example: 'Senior Frontend Engineer', description: 'Workers only' })
  @IsOptional() @IsString() @MaxLength(120)
  jobTitle?: string;

  @ApiPropertyOptional({ example: 'Senior', description: 'Workers only' })
  @IsOptional() @IsString() @MaxLength(40)
  experienceLevel?: string;

  @ApiPropertyOptional({ example: 1500, description: 'INR per hour; workers and experts' })
  @IsOptional() @IsNumber() @Min(0)
  hourlyRate?: number;

  @ApiPropertyOptional({
    description: 'Workers: text such as "Full-time". Experts: { status, maxCases, type }.',
  })
  @Allow()
  availability?: unknown;

  @ApiPropertyOptional({ example: ['English', 'Hindi'], description: 'Workers only' })
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(40, { each: true })
  languages?: string[];

  @ApiPropertyOptional({ type: [PortfolioProjectDto], description: 'Workers only' })
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => PortfolioProjectDto)
  portfolioProjects?: PortfolioProjectDto[];

  @ApiPropertyOptional({ example: ['frontend', 'security'], description: 'Experts only: review preferences' })
  @IsOptional() @IsArray() @IsIn(AUDIT_DOMAIN_IDS as unknown as string[], { each: true })
  auditDomains?: string[];

  // ── Protected fields (declared only so a change can be refused) ──

  @ApiPropertyOptional({
    description: 'Read-only here; must match the current value if sent.',
  })
  @Allow()
  email?: unknown;

  @ApiPropertyOptional({
    description: 'Read-only here; must match the current value if sent.',
  })
  @Allow()
  role?: unknown;

  @ApiPropertyOptional({
    description: 'Not changeable through a profile update.',
  })
  @Allow()
  password?: unknown;

  @ApiPropertyOptional({
    description: 'Operations only, via PATCH /users/:id/status.',
  })
  @Allow()
  status?: unknown;

  @ApiPropertyOptional({
    description: 'Never writable; balances move through ledger operations.',
  })
  @Allow()
  walletBalance?: unknown;

  @ApiPropertyOptional({ description: 'Computed by the platform.' })
  @Allow()
  rating?: unknown;

  @ApiPropertyOptional({ description: 'Computed by the platform.' })
  @Allow()
  completedProjects?: unknown;

  @ApiPropertyOptional({ description: 'Computed by the platform.' })
  @Allow()
  reviewsDone?: unknown;
}

/** Fields a profile update may never change. */
export const PROTECTED_PROFILE_FIELDS = [
  'email',
  'role',
  'password',
  'status',
  'walletBalance',
  'rating',
  'completedProjects',
  'reviewsDone',
] as const;

/** `PATCH /users/:id/status` — operations administration. */
export class UpdateUserStatusDto {
  @ApiProperty({ example: 'suspended', enum: ['active', 'suspended'] })
  @IsIn(['active', 'suspended'])
  status: 'active' | 'suspended';
}
