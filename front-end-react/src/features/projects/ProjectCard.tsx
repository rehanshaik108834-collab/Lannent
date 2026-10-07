import type { ReactNode } from 'react';
import { formatDate, formatMoney } from '../../shared/format/format';
import type { Project } from '../../shared/types/domain';
import { StatusBadge } from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';

/** One project in a list. Role-specific actions are passed in by the page. */
export function ProjectCard({
  project,
  children,
}: {
  project: Project;
  children?: ReactNode;
}) {
  return (
    <li className={page.item}>
      <div className={page.itemHead}>
        <h2>{project.title}</h2>
        <StatusBadge status={project.status} />
      </div>
      <div className={page.meta}>
        <span>{project.category}</span>
        <span>Budget {formatMoney(project.budget)}</span>
        <span>Due {formatDate(project.deadline)}</span>
        {project.status !== 'open' && <span>{project.progress}% complete</span>}
      </div>
      {project.status !== 'open' && (
        <div className={page.progress} aria-hidden="true">
          <span
            style={{
              width: `${Math.min(100, Math.max(0, project.progress))}%`,
            }}
          />
        </div>
      )}
      {children && <div className={page.inline}>{children}</div>}
    </li>
  );
}
