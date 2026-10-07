import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UnitOfWork } from '../../common/unit-of-work/unit-of-work';
import { UsersRepository } from '../users/users.repository';
import { FilesRepository } from '../files/files.repository';
import type { Actor } from '../../common/decorators/current-actor.decorator';
import { CreateExpertApplicationDto } from './dto/create-expert-application.dto';
import { UpdateExpertApplicationStatusDto } from './dto/update-expert-application.dto';
import { ExpertApplicationsRepository } from './expert-applications.repository';
import { UsersService } from '../users/users.service';
import { hashPassword } from '../../common/security/password.util';
import { AppLoggerService } from '../../common/logging/app-logger.service';

/**
 * ExpertApplicationsService — Business Logic Layer
 *
 * Handles application review and auto-creation of expert user accounts.
 * Delegates all data-access operations to ExpertApplicationsRepository.
 */
@Injectable()
export class ExpertApplicationsService {
  constructor(
    private readonly expertApplicationsRepository: ExpertApplicationsRepository,
    private usersService: UsersService,
    private readonly log: AppLoggerService,
    private readonly uow: UnitOfWork,
    private readonly files: FilesRepository,
  ) {}

  /**
   * An applicant chooses a password on the form, so the stored record holds one.
   * It is needed to create their account on approval and must never leave the
   * server — every read strips it.
   */
  private redact(app: any) {
    if (!app) return app;
    const { password, ...safe } = app;
    return safe;
  }

  findAll() {
    return this.expertApplicationsRepository
      .findAll()
      .map((a: any) => this.redact(a));
  }

  findById(id: string) {
    const app = this.expertApplicationsRepository.findById(id);
    if (!app)
      throw new NotFoundException(
        `Expert application with id "${id}" not found`,
      );
    return this.redact(app);
  }

  /** Public: whether an application exists for this email, and nothing else. */
  statusFor(email: string) {
    if (!email) return { exists: false, status: null };
    const app = this.expertApplicationsRepository
      .findAll()
      .find((a: any) => String(a.email).toLowerCase() === email.toLowerCase());
    return app
      ? { exists: true, status: app.status }
      : { exists: false, status: null };
  }

  /**
   * Public application. The applicant chooses their password here; it is
   * hashed immediately and becomes the account password on approval.
   *
   * Refused when the email already has an account or an open/approved
   * application. Attached documents must be files uploaded through the public
   * application route and not already attached to another application, so an
   * application cannot be used to expose someone else's project file.
   */
  create(dto: CreateExpertApplicationDto) {
    const email = dto.email.trim().toLowerCase();
    if (this.usersService.findByEmail(email)) {
      throw new ConflictException(
        'An account with this email already exists. Sign in instead.',
      );
    }
    const open = this.expertApplicationsRepository
      .findAll()
      .find(
        (a: any) =>
          String(a.email).toLowerCase() === email && a.status !== 'rejected',
      );
    if (open) {
      throw new ConflictException(
        `An application with this email is already ${open.status}.`,
      );
    }

    const app = {
      ...dto,
      id: this.expertApplicationsRepository.generateId(),
      email,
      status: 'pending',
      appliedAt: new Date().toISOString().slice(0, 10),
      reviewedAt: null,
      reviewedBy: null,
      accountId: null,
      resumeFile: this.applicationDocument(dto.resumeFile?.id),
      certificateFile: this.applicationDocument(dto.certificateFile?.id),
      password: hashPassword(dto.password),
    };
    return this.redact(this.expertApplicationsRepository.insert(app));
  }

  /** Validates a document reference and returns the server's own record of it. */
  private applicationDocument(fileId?: string) {
    if (!fileId) return null;
    const files = this.files;
    const record = files.findById(fileId);
    if (
      !record ||
      record.purpose !== 'expert-application' ||
      record.taskId ||
      record.uploadedBy
    ) {
      throw new BadRequestException(
        'Attach documents uploaded with this application form.',
      );
    }
    const taken = this.expertApplicationsRepository
      .findAll()
      .some(
        (a: any) =>
          a.resumeFile?.id === fileId || a.certificateFile?.id === fileId,
      );
    if (taken)
      throw new BadRequestException(
        'That document is already attached to another application.',
      );
    return {
      id: record.id,
      name: record.name,
      size: record.size,
      mime: record.mime,
      url: `/api/files/${record.id}`,
    };
  }

  /**
   * The intake desk approves or rejects a pending application.
   *
   * Approval creates the expert account with the applicant's chosen password
   * and records the decision in one unit of work: if the account cannot be
   * created (no password, email now taken, any failure), the application stays
   * pending and nothing is created. Repeating the recorded decision returns it;
   * reversing a decision is refused.
   */
  updateStatus(
    id: string,
    dto: UpdateExpertApplicationStatusDto,
    actor: Actor,
  ) {
    const app = this.expertApplicationsRepository.findById(id);
    if (!app)
      throw new NotFoundException(
        `Expert application with id "${id}" not found`,
      );
    if (dto.reviewedBy && dto.reviewedBy !== actor.id) {
      throw new BadRequestException('reviewedBy must be your own account.');
    }
    if (app.status === dto.status) return this.redact(app);
    if (app.status !== 'pending') {
      throw new ConflictException(
        `This application was already ${app.status}; that decision is final.`,
      );
    }

    const decision = {
      status: dto.status,
      reviewedAt: new Date().toISOString().slice(0, 10),
      reviewedBy: actor.id,
      // The chosen password is only needed to create the account.
      password: undefined,
    };

    if (dto.status === 'rejected') {
      return this.redact(
        this.expertApplicationsRepository.update(id, decision),
      );
    }

    const passwordHash = app.password;
    if (!passwordHash) {
      throw new ConflictException(
        'This application has no chosen password, so no account can be created. Ask the applicant to apply again.',
      );
    }
    if (this.usersService.findByEmail(app.email)) {
      throw new ConflictException(
        `An account already uses ${app.email}; the application was left pending.`,
      );
    }

    const approved = this.uow.run(
      [ExpertApplicationsRepository, UsersRepository],
      () => {
        const account = this.usersService.createExpertFromApplication({
          name: app.name,
          email: app.email,
          passwordHash,
          specialization: app.expertise || '',
        });
        if (!account)
          throw new Error(`Expert account for ${app.email} was not created.`);
        const recorded = this.expertApplicationsRepository.update(id, {
          ...decision,
          accountId: account.id,
        });
        if (!recorded)
          throw new NotFoundException(
            `Expert application with id "${id}" not found`,
          );
        return recorded;
      },
    );
    this.log.log(
      'expertApplications.approve',
      `application ${id} approved; expert account ${approved.accountId} created`,
    );
    return this.redact(approved);
  }

  resetToSeed() {
    this.expertApplicationsRepository.resetToSeed();
  }
}
