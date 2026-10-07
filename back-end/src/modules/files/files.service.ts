import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { existsSync, unlinkSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { FilesRepository } from './files.repository';
import { UPLOAD_DIR, ensureUploadDir } from './upload.config';
import { TasksAccessService } from '../tasks/tasks-access.service';
import { AuditRequestsRepository } from '../audit-requests/audit-requests.repository';
import {
  canViewTask,
  canViewAnyRecord,
  canDeleteAnyFile,
} from '../../common/guards/viewer.util';
import { AppLoggerService } from '../../common/logging/app-logger.service';
import { ROLES } from '../../common/constants/roles';
import { MilestonesRepository } from '../milestones/milestones.repository';
import { ExpertApplicationsRepository } from '../expert-applications/expert-applications.repository';

export interface Viewer {
  id?: string;
  role?: string;
}

/**
 * FilesService — Business Logic Layer
 *
 * Owns the metadata record and the access rules; multer has already written
 * the bytes by the time anything here runs.
 */
@Injectable()
export class FilesService {
  constructor(
    private readonly filesRepository: FilesRepository,
    private readonly tasks: TasksAccessService,
    private readonly auditRequests: AuditRequestsRepository,
    private readonly log: AppLoggerService,
    private readonly milestones: MilestonesRepository,
    private readonly applications: ExpertApplicationsRepository,
  ) {
    ensureUploadDir();
  }

  /**
   * Records an uploaded file and returns the reference a deliverable stores.
   *
   * A signed-in upload that names a project must come from someone who can
   * see that project, and a named milestone must belong to it, so files cannot
   * be planted on other people's work. The application purpose is reserved for
   * the public application route.
   */
  create(
    file: any,
    viewer: Viewer,
    meta?: { taskId?: string; milestoneId?: string; purpose?: string },
  ) {
    if (!file)
      throw new BadRequestException(
        'No file was received. Send it in the "file" field.',
      );
    if (viewer.id) {
      try {
        this.assertCanAttach(viewer, meta);
      } catch (refusal) {
        // multer has already written the bytes; a refused upload must not
        // leave an unreachable file behind.
        this.safeUnlink(join(UPLOAD_DIR, basename(file.filename)));
        throw refusal;
      }
    }

    const record = {
      id: this.filesRepository.generateId(),
      name: file.originalname,
      storedName: file.filename,
      size: file.size,
      mime: file.mimetype,
      uploadedBy: viewer.id || null,
      taskId: meta?.taskId || null,
      milestoneId: meta?.milestoneId || null,
      purpose: meta?.purpose || null,
      createdAt: new Date().toISOString(),
    };
    this.filesRepository.insert(record);

    this.log.log(
      'files.upload',
      `${record.id} "${record.name}" ${record.size}b ${record.mime}`,
    );
    return this.toRef(record);
  }

  /** The shape stored on a deliverable or an application. */
  private toRef(record: any) {
    return {
      id: record.id,
      name: record.name,
      size: record.size,
      mime: record.mime,
      url: `/api/files/${record.id}`,
      uploadedBy: record.uploadedBy,
    };
  }

  findById(id: string, viewer?: Viewer) {
    const record = this.filesRepository.findById(id);
    if (!record) throw new NotFoundException(`File with id "${id}" not found`);
    if (viewer && !this.canView(record, viewer)) {
      throw new ForbiddenException(
        'You do not have access to this file. Only the people involved in the project can open it.',
      );
    }
    return record;
  }

  meta(id: string, viewer?: Viewer) {
    return this.toRef(this.findById(id, viewer));
  }

  /** The path to stream, checked to still be inside the upload directory. */
  pathFor(id: string, viewer?: Viewer) {
    const record = this.findById(id, viewer);
    const full = join(UPLOAD_DIR, basename(record.storedName));
    if (!full.startsWith(UPLOAD_DIR)) {
      throw new ForbiddenException('Invalid file path.');
    }
    if (!existsSync(full)) {
      // The metadata is in memory and the bytes are on disk, so these can drift
      // — a restart with a cleared uploads directory lands here.
      this.log.warn(
        'files.read',
        `record ${id} points at a missing file (${record.storedName})`,
      );
      throw new NotFoundException(
        'That file is no longer stored on the server.',
      );
    }
    return { path: full, record };
  }

  private assertCanAttach(
    viewer: Viewer,
    meta?: { taskId?: string; milestoneId?: string; purpose?: string },
  ) {
    if (
      meta?.purpose &&
      !['deliverable', 'attachment'].includes(meta.purpose)
    ) {
      throw new BadRequestException(
        'purpose must be "deliverable" or "attachment".',
      );
    }
    if (meta?.milestoneId && !meta.taskId) {
      throw new BadRequestException(
        'Name the project (taskId) the milestone belongs to.',
      );
    }
    if (!meta?.taskId) return;
    const task = this.tasks.findById(meta.taskId);
    // Participants only: the client, the hired worker, or an engaged reviewer.
    // Being able to *see* an open project is not enough to attach to it, and
    // oversight roles read files; they do not add them.
    const engagedReviewers =
      this.safe(() =>
        this.auditRequests
          .findAll({ taskId: task.id })
          .map((ar: any) => ar.expertId),
      ) || [];
    const participant =
      task.clientId === viewer.id ||
      task.workerId === viewer.id ||
      engagedReviewers.includes(viewer.id);
    if (!participant) {
      throw new ForbiddenException(
        'You can only attach files to projects you are working on.',
      );
    }
    if (meta.milestoneId) {
      const milestones = this.milestones;
      const ms = milestones.findById(meta.milestoneId);
      if (!ms || ms.taskId !== task.id) {
        throw new BadRequestException(
          'That milestone does not belong to this project.',
        );
      }
    }
  }

  /**
   * True for a document uploaded through the public application route and
   * referenced by an expert application. Only such files are opened to intake;
   * a project file named in an application does not qualify (applications
   * reject such references when they are submitted).
   */
  private isApplicationDocument(record: any): boolean {
    if (
      record.purpose !== 'expert-application' ||
      record.taskId ||
      record.uploadedBy
    )
      return false;
    const applications = this.applications;
    return applications
      .findAll()
      .some(
        (a: any) =>
          a.resumeFile?.id === record.id || a.certificateFile?.id === record.id,
      );
  }

  /**
   * Who may open a file.
   *
   * The uploader always may. Beyond that, a file attached to a project follows
   * that project's participants, so a deliverable is not world-readable just
   * because someone guessed an id. A file with no project — a résumé on an
   * expert application — is uploader-and-staff only.
   */
  private canView(record: any, viewer: Viewer): boolean {
    if (canViewAnyRecord(viewer.role)) return true;
    // Intake reviews applications, so it reads their résumés and certificates,
    // and nothing else.
    if (viewer.role === ROLES.INTAKE_ADMIN)
      return this.isApplicationDocument(record);
    if (record.uploadedBy && record.uploadedBy === viewer.id) return true;
    if (!record.taskId) return false;
    const task = this.safe(() => this.tasks.findById(record.taskId));

    // The reviewer engaged on this project is not one of its participants, but
    // auditing the work means opening the files that are the work. Without
    // this they were handed a deliverable they could not download.
    const reviewers =
      this.safe(() =>
        this.auditRequests
          .findAll({ taskId: record.taskId })
          .map((ar: any) => ar.expertId)
          .filter(Boolean),
      ) || [];

    return canViewTask(
      viewer.id,
      viewer.role,
      task,
      record.uploadedBy,
      ...reviewers,
    );
  }

  remove(id: string, viewer: Viewer) {
    const record = this.findById(id);
    const owns = record.uploadedBy && record.uploadedBy === viewer.id;
    if (!owns && !canDeleteAnyFile(viewer.role)) {
      throw new ForbiddenException(
        'Only the person who uploaded a file, or operations staff, can delete it.',
      );
    }
    this.filesRepository.remove(id);
    this.safeUnlink(join(UPLOAD_DIR, basename(record.storedName)));
    this.log.log('files.delete', `${id} "${record.name}" removed`);
    return { deleted: true, id };
  }

  /**
   * Deletes files on disk that no record points at.
   *
   * Metadata is in memory, so every restart orphans whatever was uploaded in
   * the previous run. Without this the directory grows forever with bytes
   * nothing can reach.
   */
  sweepOrphans(): { removed: number } {
    ensureUploadDir();
    const known = new Set(this.filesRepository.storedNames());
    let removed = 0;
    for (const name of readdirSync(UPLOAD_DIR)) {
      if (name.startsWith('.')) continue;
      if (!known.has(name)) {
        this.safeUnlink(join(UPLOAD_DIR, name));
        removed++;
      }
    }
    if (removed)
      this.log.log(
        'files.sweep',
        `removed ${removed} orphaned file(s) from uploads/`,
      );
    return { removed };
  }

  resetToSeed() {
    this.filesRepository.resetToSeed();
    this.sweepOrphans();
  }

  private safeUnlink(path: string) {
    try {
      if (existsSync(path)) unlinkSync(path);
    } catch (e) {
      this.log.warn('files.unlink', `could not delete ${path}`, e);
    }
  }

  private safe<T>(fn: () => T): T | null {
    try {
      return fn();
    } catch {
      return null;
    }
  }
}
