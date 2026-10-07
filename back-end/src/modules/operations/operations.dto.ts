import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty, OmitType } from '@nestjs/swagger';
import { CreateTaskDto } from '../tasks/dto/create-task.dto';

export class CreateProjectForClientDto extends OmitType(CreateTaskDto, [
  'clientId',
] as const) {
  @ApiProperty({
    description: 'Active client whose project operations is creating',
  })
  @IsString()
  @IsNotEmpty()
  clientId: string;
}
export class AssignReviewerDto {
  @ApiProperty({
    description: 'Active, eligible expert assigned to this dispute',
  })
  @IsString()
  @IsNotEmpty()
  expertId: string;
}

export class EditOperationsProjectDto {
  @IsString()
  @IsNotEmpty()
  title: string;
  @IsString()
  description: string;
}
