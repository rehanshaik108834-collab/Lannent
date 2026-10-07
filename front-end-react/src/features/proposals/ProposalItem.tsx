import type { ReactNode } from 'react';
import { formatDate } from '../../shared/format/format';
import type { Proposal } from '../../shared/types/domain';
import { StatusBadge } from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';

/** A proposal or invitation. Worker details come from the server, not the submitter. */
export function ProposalItem({
  proposal,
  title,
  children,
}: {
  proposal: Proposal;
  title: string;
  children?: ReactNode;
}) {
  return (
    <li className={page.item}>
      <div className={page.itemHead}>
        <h3>{title}</h3>
        <StatusBadge status={proposal.status} />
      </div>
      <div className={page.meta}>
        {proposal.bidPrice && <span>Bid {proposal.bidPrice}</span>}
        {proposal.timeline && <span>{proposal.timeline}</span>}
        {typeof proposal.rating === 'number' && proposal.rating > 0 && (
          <span>Rating {proposal.rating}</span>
        )}
        {typeof proposal.completedProjects === 'number' && (
          <span>{proposal.completedProjects} projects done</span>
        )}
        <span>Sent {formatDate(proposal.createdAt)}</span>
      </div>
      {proposal.coverLetter && <p>{proposal.coverLetter}</p>}
      {children && <div className={page.inline}>{children}</div>}
    </li>
  );
}
