import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { AuditReportsService } from './audit-reports.service';
import { CreateAuditReportDto } from './dto/create-audit-report.dto';
import { RoleGuard } from '../../common/guards/role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/decorators/current-actor.decorator';

@ApiTags('Audit Reports')
@Controller('audit-reports')
@UseGuards(RoleGuard)
export class AuditReportsController {
  constructor(private readonly auditReportsService: AuditReportsService) {}

  @Get()
  @ApiOperation({ summary: 'Audit reports on projects you are party to (supports ?taskId=&auditRequestId=)' })
  @ApiQuery({ name: 'taskId', required: false })
  @ApiQuery({ name: 'auditRequestId', required: false })
  findAll(
    @CurrentActor() actor: Actor,
    @Query('taskId') taskId?: string,
    @Query('auditRequestId') auditRequestId?: string,
  ) {
    return this.auditReportsService.findAll({ taskId, auditRequestId }, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an audit report on a project you are party to' })
  findOne(@Param('id') id: string, @CurrentActor() actor: Actor) {
    return this.auditReportsService.findById(id, actor);
  }

  @Post()
  @ApiBearerAuth()
  // Filing a report can release the reviewer's fee from escrow, so only the
  // engagement's assigned reviewer may do it — operations cannot file on an
  // expert's behalf.
  @Roles('expert')
  @ApiOperation({ summary: "File the assigned reviewer's report for one milestone (may release the audit fee)" })
  create(@Body() dto: CreateAuditReportDto, @CurrentActor() actor: Actor) {
    return this.auditReportsService.create(dto, actor);
  }
}
