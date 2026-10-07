import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { LoggingModule } from '../../common/logging/logging.module';
import { MilestonesModule } from './milestones.module';
import { DisputesModule } from '../disputes/disputes.module';
import { AuditReportsModule } from '../audit-reports/audit-reports.module';
import { MilestonesService } from './milestones.service';
import { MilestonesRepository } from './milestones.repository';
import { DisputesService } from '../disputes/disputes.service';
import { DisputesRepository } from '../disputes/disputes.repository';
import { AuditReportsService } from '../audit-reports/audit-reports.service';
import { AuditReportsRepository } from '../audit-reports/audit-reports.repository';
import { AuditRequestsRepository } from '../audit-requests/audit-requests.repository';
import { TasksRepository } from '../tasks/tasks.repository';
import { TasksModule } from '../tasks/tasks.module';
import { TasksAccessService } from '../tasks/tasks-access.service';
import { UsersService } from '../users/users.service';
import { TransactionsRepository } from '../transactions/transactions.repository';
import { LedgerService } from '../ledger/ledger.service';
import { resetFeeConfig } from '../ledger/fee-config';
import type { Actor } from '../../common/decorators/current-actor.decorator';

/**
 * Milestone settlement workflows (D08, D09): approval, dispute verdicts and
 * audit reports. Each test builds its own project so it does not depend on
 * seed dates or on other tests' mutations.
 */
describe('Milestone settlement', () => {
  let milestones: MilestonesService;
  let disputes: DisputesService;
  let reports: AuditReportsService;
  let ledger: LedgerService;
  let users: UsersService;
  let tasksService: TasksAccessService;
  let repos: {
    milestones: MilestonesRepository;
    tasks: TasksRepository;
    disputes: DisputesRepository;
    auditRequests: AuditRequestsRepository;
    auditReports: AuditReportsRepository;
    transactions: TransactionsRepository;
  };

  const client: Actor = { id: 'u1', role: 'client' };
  const otherClient: Actor = { id: 'u8', role: 'client' };
  const worker: Actor = { id: 'u2', role: 'worker' };
  const reviewer: Actor = { id: 'u3', role: 'expert' };
  const otherReviewer: Actor = { id: 'u9', role: 'expert' };

  beforeEach(async () => {
    resetFeeConfig();
    const mod = await Test.createTestingModule({
      imports: [
        TasksModule,
        LoggingModule,
        MilestonesModule,
        DisputesModule,
        AuditReportsModule,
      ],
    }).compile();

    milestones = mod.get(MilestonesService);
    disputes = mod.get(DisputesService);
    reports = mod.get(AuditReportsService);
    ledger = mod.get(LedgerService);
    users = mod.get(UsersService);
    tasksService = mod.get(TasksAccessService);
    repos = {
      milestones: mod.get(MilestonesRepository),
      tasks: mod.get(TasksRepository),
      disputes: mod.get(DisputesRepository),
      auditRequests: mod.get(AuditRequestsRepository),
      auditReports: mod.get(AuditReportsRepository),
      transactions: mod.get(TransactionsRepository),
    };

    // A funded project with an odd-paise milestone, so split rounding shows.
    repos.tasks.insert({
      description: '',
      currency: 'INR',
      skills: [],
      createdAt: '2026-10-01',
      id: 'tx1',
      title: 'Test project',
      category: 'Web Development',
      budget: 1500.01,
      clientId: 'u1',
      workerId: 'u2',
      status: 'in-progress',
      auditEnabled: false,
      progress: 0,
    });
    repos.milestones.insert({
      description: '',
      approvedAt: null,
      deliverable: null,
      dueDate: null,
      priority: 'Medium',
      id: 'ms1',
      taskId: 'tx1',
      title: 'Build',
      budget: 1000.01,
      workerId: 'u2',
      status: 'submitted',
      submittedAt: '2026-10-01',
      progress: 90,
    });
    repos.milestones.insert({
      description: '',
      submittedAt: null,
      approvedAt: null,
      deliverable: null,
      dueDate: null,
      priority: 'Medium',
      id: 'ms2',
      taskId: 'tx1',
      title: 'Ship',
      budget: 500,
      workerId: 'u2',
      status: 'pending',
      progress: 0,
    });
    ledger.deposit('u1', 5000);
    ledger.fundProjectEscrow('tx1', 'u1', 1500.01, 'Test project');
  });

  /** Everything a settlement could change, for before/after comparison. */
  const state = () => ({
    workerBalance: users.findById('u2').walletBalance,
    clientBalance: users.findById('u1').walletBalance,
    expertBalance: users.findById('u3').walletBalance,
    escrow: { ...ledger.getEscrow('tx1') },
    ms1: { ...repos.milestones.findById('ms1') },
    task: { ...repos.tasks.findById('tx1') },
    transactions: repos.transactions.findAll().length,
    released: ledger.getMilestoneRelease('ms1'),
  });

  describe('client approval', () => {
    it('pays the worker once and rolls progress up to the project', () => {
      const before = state();
      const approved = milestones.approveDeliverable('ms1', client);

      expect(approved.status).toBe('completed');
      expect(approved.release.alreadyReleased).toBe(false);
      expect(ledger.getEscrow('tx1').projectHeld).toBe(500);
      expect(users.findById('u2').walletBalance).toBeCloseTo(
        before.workerBalance + approved.release.net,
        2,
      );
      expect(repos.tasks.findById('tx1')!.progress).toBe(50);

      const afterFirst = state();
      const replay = milestones.approveDeliverable('ms1', client);
      expect(replay.release).toMatchObject({
        alreadyReleased: true,
        net: approved.release.net,
      });
      expect(state()).toEqual(afterFirst);
    });

    it('refuses a client who does not own the project', () => {
      const before = state();
      expect(() => milestones.approveDeliverable('ms1', otherClient)).toThrow(
        ForbiddenException,
      );
      expect(state()).toEqual(before);
    });

    it('refuses work that has not been submitted', () => {
      expect(() => milestones.approveDeliverable('ms2', client)).toThrow(
        ConflictException,
      );
      expect(ledger.getEscrow('tx1').projectHeld).toBe(1500.01);
    });

    it('freezes a milestone while a dispute about it is open', () => {
      repos.disputes.insert({
        reason: 'Test dispute',
        createdAt: '2026-10-01',
        resolution: null,
        resolvedAt: null,
        raisedBy: 'u1',
        againstId: 'u2',
        verdict: null,
        id: 'dx1',
        taskId: 'tx1',
        milestoneId: 'ms1',
        status: 'open',
        expertId: 'u3',
      });
      const before = state();
      expect(() => milestones.approveDeliverable('ms1', client)).toThrow(
        ConflictException,
      );
      expect(state()).toEqual(before);
    });

    it('requires the exact milestone report when the project is audited', () => {
      repos.tasks.update('tx1', { auditEnabled: true });
      repos.auditRequests.insert({
        createdAt: '2026-10-01',
        offers: [],
        id: 'arx',
        kind: 'project-audit',
        taskId: 'tx1',
        expertId: 'u3',
        clientId: 'u1',
        status: 'in-progress',
        agreedAmount: 300,
        auditedMilestoneIds: ['ms2'],
      });
      // A report on a different milestone does not count.
      expect(() => milestones.approveDeliverable('ms1', client)).toThrow(
        ConflictException,
      );

      repos.auditRequests.update('arx', {
        auditedMilestoneIds: ['ms2', 'ms1'],
      });
      expect(milestones.approveDeliverable('ms1', client).status).toBe(
        'completed',
      );
    });

    it('rolls back the payout when a later step fails', () => {
      const before = state();
      jest.spyOn(tasksService, 'update').mockImplementation(() => {
        throw new Error('progress rollup failed');
      });
      expect(() => milestones.approveDeliverable('ms1', client)).toThrow(
        'progress rollup failed',
      );
      expect(state()).toEqual(before);
    });
  });

  describe('worker submission', () => {
    it('accepts work only from the assigned worker', () => {
      expect(() =>
        milestones.submitDeliverable('ms2', undefined, {
          id: 'u6',
          role: 'worker',
        }),
      ).toThrow(ForbiddenException);
      expect(
        milestones.submitDeliverable('ms2', undefined, worker)!.status,
      ).toBe('submitted');
    });

    it('refuses submissions for finished work', () => {
      milestones.approveDeliverable('ms1', client);
      expect(() =>
        milestones.submitDeliverable('ms1', undefined, worker),
      ).toThrow(ConflictException);
    });
  });

  describe('dispute verdicts', () => {
    beforeEach(() => {
      repos.milestones.update('ms1', { status: 'disputed' });
      repos.disputes.insert({
        reason: 'Test dispute',
        createdAt: '2026-10-01',
        resolution: null,
        resolvedAt: null,
        id: 'dx1',
        taskId: 'tx1',
        milestoneId: 'ms1',
        status: 'open',
        expertId: 'u3',
        raisedBy: 'u1',
        againstId: 'u2',
        verdict: null,
      });
    });
    const verdict = (v: string, actor: Actor = reviewer, extra = {}) =>
      disputes.resolve(
        'dx1',
        { verdict: v, resolution: 'Reviewed.', ...extra } as any,
        actor,
      );

    it('lets only the assigned reviewer decide, and rejects a forged reviewer id', () => {
      const before = state();
      expect(() => verdict('worker-favour', otherReviewer)).toThrow(
        ForbiddenException,
      );
      expect(() =>
        verdict('worker-favour', reviewer, { expertId: 'u9' }),
      ).toThrow(BadRequestException);
      expect(state()).toEqual(before);
    });

    it('client-favour keeps the money held for rework, then pays once on approval', () => {
      const before = state();
      const result = verdict('client-favour');

      expect(result.settlement!.kind).toBe('funded-rework');
      expect(repos.milestones.findById('ms1')!.status).toBe('revision-needed');
      expect(ledger.getEscrow('tx1')).toEqual(before.escrow);
      expect(users.findById('u1').walletBalance).toBe(before.clientBalance);

      milestones.submitDeliverable('ms1', undefined, worker);
      const approved = milestones.approveDeliverable('ms1', client);
      expect(approved.release.amount).toBe(1000.01);
      expect(ledger.getEscrow('tx1').projectHeld).toBe(500);
    });

    it('worker-favour pays once; the same verdict replays and a different one conflicts', () => {
      const result = verdict('worker-favour');
      expect(result.settlement!.release!.amount).toBe(1000.01);
      expect(repos.milestones.findById('ms1')!.status).toBe('completed');

      const after = state();
      expect(verdict('worker-favour').replayed).toBe(true);
      expect(() => verdict('split')).toThrow(ConflictException);
      expect(state()).toEqual(after);
    });

    it('split gives the worker half rounded down and the client the odd paisa', () => {
      const before = state();
      const { settlement } = verdict('split');

      expect(settlement!.release!.amount).toBe(500);
      expect(settlement!.refund!.amount).toBe(500.01);
      expect(users.findById('u1').walletBalance).toBeCloseTo(
        before.clientBalance + 500.01,
        2,
      );
      // Fees apply only to the worker's share.
      expect(settlement!.release!.net).toBeCloseTo(
        500 - settlement!.release!.fee,
        2,
      );
      expect(ledger.getEscrow('tx1').projectHeld).toBe(500);
    });

    it('leaves the dispute open and every balance unchanged when settlement fails', () => {
      const before = state();
      jest.spyOn(ledger, 'refundToClient').mockImplementation(() => {
        throw new BadRequestException('refund failed');
      });
      expect(() => verdict('split')).toThrow('refund failed');
      expect(state()).toEqual(before);
      expect(repos.milestones.findById('ms1')!.status).toBe('disputed');
      expect(repos.disputes.findById('dx1')!.status).toBe('open');
    });
  });

  describe('audit reports', () => {
    beforeEach(() => {
      repos.tasks.update('tx1', { auditEnabled: true });
      repos.auditRequests.insert({
        createdAt: '2026-10-01',
        offers: [],
        id: 'arx',
        kind: 'project-audit',
        taskId: 'tx1',
        expertId: 'u3',
        clientId: 'u1',
        status: 'in-progress',
        agreedAmount: 300,
        auditedMilestoneIds: ['ms2'],
      });
    });
    const file = (
      milestoneId: string | undefined,
      actor: Actor = reviewer,
      taskId = 'tx1',
    ) =>
      reports.create(
        {
          auditRequestId: 'arx',
          taskId,
          milestoneId,
          expertId: actor.id,
        } as any,
        actor,
      );

    it('accepts reports only from the assigned reviewer for a milestone of the project', () => {
      expect(() => file('ms1', otherReviewer)).toThrow(ForbiddenException);
      expect(() => file(undefined)).toThrow(BadRequestException);
      expect(() => file('m1')).toThrow(BadRequestException); // another project's milestone
    });

    it('stores no report and no coverage when the payout fails', () => {
      // Coverage completes with ms1, so the fee is due — but none was funded.
      const reportsBefore = repos.auditReports.findAll().length;
      expect(() => file('ms1')).toThrow(BadRequestException);
      expect(repos.auditReports.findAll().length).toBe(reportsBefore);
      expect(repos.auditRequests.findById('arx')!.auditedMilestoneIds).toEqual([
        'ms2',
      ]);
    });

    it('pays the reviewer once coverage completes, and never twice', () => {
      ledger.fundAuditEscrow('tx1', 'u1', 300);
      const first = file('ms1');
      expect(first.payout).toMatchObject({
        alreadyPaid: false,
        amount: 300,
        net: 270,
      });

      const balance = users.findById('u3').walletBalance;
      const repeatedPayout = file('ms1').payout;
      expect(
        'alreadyPaid' in repeatedPayout && repeatedPayout.alreadyPaid,
      ).toBe(true);
      expect(users.findById('u3').walletBalance).toBe(balance);
    });
  });
});
