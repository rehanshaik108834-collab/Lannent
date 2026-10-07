import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleGuard } from '../../common/guards/role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/decorators/current-actor.decorator';
import { OperationsService } from './operations.service';
import {
  AssignReviewerDto,
  CreateProjectForClientDto,
  EditOperationsProjectDto,
} from './operations.dto';
@ApiTags('Operations')
@ApiBearerAuth()
@Controller('operations')
@UseGuards(RoleGuard)
@Roles('superuser')
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}
  @Post('projects')
  create(
    @Body() input: CreateProjectForClientDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.operations.createProject(input, actor);
  }
  @Patch('projects/:id')
  edit(
    @Param('id') id: string,
    @Body() input: EditOperationsProjectDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.operations.editProject(id, input, actor);
  }
  @Patch('disputes/:id/reviewer')
  assign(
    @Param('id') id: string,
    @Body() input: AssignReviewerDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.operations.assignReviewer(id, input.expertId, actor);
  }
}
