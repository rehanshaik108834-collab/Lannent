import { Link, useParams } from 'react-router-dom';
import { useActor } from '../../shared/api/actor';
import { formatDate } from '../../shared/format/format';
import type { AuditReport } from '../../shared/types/domain';
import {
  Card,
  EmptyState,
  PageHeader,
  QueryView,
  StatusBadge,
} from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';
import { useReport, useReports } from '../audits/hooks';

const SCORES: [keyof AuditReport, string][] = [
  ['codequality', 'Code quality'],
  ['security', 'Security'],
  ['performance', 'Performance'],
  ['documentation', 'Documentation'],
];

/**
 * Audit reports you may read. With a project id in the URL it is that
 * project's reports; otherwise every report the server shows you. A report is
 * advisory: the client still decides whether to approve the work.
 */
export function ReportsListPage() {
  const { id } = useParams();
  const actor = useActor();
  const reports = useReports(id ? { taskId: id } : {});
  const title = id
    ? 'Milestone reports'
    : actor.role === 'expert'
      ? 'My reports'
      : 'Milestone reports';
  return (
    <>
      <PageHeader
        title={title}
        subtitle="Expert assessments of milestone deliverables."
      />
      <QueryView query={reports}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState title="No reports yet" />
          ) : (
            <ul className={page.list}>
              {[...list]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((r) => (
                  <li key={r.id} className={page.item}>
                    <div className={page.itemHead}>
                      <h2>{r.milestoneTitle ?? 'Milestone'}</h2>
                      {r.verdict && <StatusBadge status={r.verdict} />}
                    </div>
                    <div className={page.meta}>
                      {r.projectTitle && <span>{r.projectTitle}</span>}
                      <span>Filed {formatDate(r.createdAt)}</span>
                    </div>
                    <Link to={`/reports/audits/${r.id}`}>Read report</Link>
                  </li>
                ))}
            </ul>
          )
        }
      </QueryView>
    </>
  );
}

export function ReportViewPage() {
  const { reportId } = useParams();
  const report = useReport(reportId);
  return (
    <QueryView query={report} level={1}>
      {(r) => (
        <>
          <PageHeader
            title={`Report: ${r.milestoneTitle ?? 'milestone'}`}
            subtitle={`${r.projectTitle ?? 'Project'} · filed ${formatDate(r.createdAt)}`}
          />
          <Card>
            <div className={page.itemHead}>
              <h2>Assessment</h2>
              {r.verdict && <StatusBadge status={r.verdict} />}
            </div>
            <p>{r.overall || 'No summary was given.'}</p>
            <div className={page.meta}>
              {SCORES.filter(([key]) => typeof r[key] === 'number').map(
                ([key, label]) => (
                  <span key={key}>
                    {label} {String(r[key])}/5
                  </span>
                ),
              )}
            </div>
          </Card>
          {r.findings && (
            <Card>
              <h2>Findings</h2>
              <p style={{ whiteSpace: 'pre-wrap' }}>{r.findings}</p>
            </Card>
          )}
          <p className={page.muted}>
            This report is the reviewer’s assessment. Approving the milestone
            remains the client’s decision.
          </p>
          <Link to={`/project/${r.taskId}/milestone-reports`}>
            All reports for this project
          </Link>
        </>
      )}
    </QueryView>
  );
}
