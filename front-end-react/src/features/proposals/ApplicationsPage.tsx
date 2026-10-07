import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useActor } from '../../shared/api/actor';
import { formatMoney } from '../../shared/format/format';
import type { Project, Proposal } from '../../shared/types/domain';
import {
  Card,
  EmptyState,
  Notice,
  PageHeader,
  QueryView,
} from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';
import { useProjects } from '../projects/hooks';
import { useAccount } from '../wallets/hooks';
import { ConfirmAction } from '../../shared/ui/ConfirmAction';
import { ProposalItem } from './ProposalItem';
import { useCloseProposal, useHire, useProposals } from './hooks';

/**
 * Proposals on the client's own open projects. Hiring funds escrow from the
 * client's wallet (budget plus marketplace and contract fees, calculated by
 * the server) and closes the project's other proposals.
 */
export function ApplicationsPage() {
  const actor = useActor();
  const [params] = useSearchParams();
  const only = params.get('taskId');
  const projects = useProjects({ clientId: actor.id, status: 'open' });
  const proposals = useProposals({ type: 'proposal' });
  const account = useAccount();
  // Kept here, not in the project's section: once hired, the project is no
  // longer open and its section leaves the list.
  const [hired, setHired] = useState<{
    projectId: string;
    message: string;
  } | null>(null);

  return (
    <>
      <PageHeader
        title="Worker applications"
        subtitle="Proposals on your open projects."
        actions={
          account.data && (
            <span className={page.muted}>
              Wallet balance {formatMoney(account.data.walletBalance)}
            </span>
          )
        }
      />
      {hired && (
        <>
          <Notice success={hired.message} />
          <Link to={`/project/${hired.projectId}/workroom`}>
            Open the workroom
          </Link>
        </>
      )}
      <QueryView query={projects}>
        {(open) => (
          <QueryView query={proposals}>
            {(all) => {
              const shown = open.filter((p) => !only || p.id === only);
              if (shown.length === 0) {
                if (hired) return null;
                return (
                  <EmptyState title="No open projects">
                    <p>
                      <Link to="/client/post-task">Post a task</Link> to start
                      receiving proposals.
                    </p>
                  </EmptyState>
                );
              }
              return shown.map((project) => (
                <ProjectApplications
                  key={project.id}
                  project={project}
                  proposals={all.filter((p) => p.taskId === project.id)}
                  onHired={(message) =>
                    setHired({ projectId: project.id, message })
                  }
                />
              ));
            }}
          </QueryView>
        )}
      </QueryView>
    </>
  );
}

function ProjectApplications({
  project,
  proposals,
  onHired,
}: {
  project: Project;
  proposals: Proposal[];
  onHired: (message: string) => void;
}) {
  const hire = useHire();
  const reject = useCloseProposal();
  const [open, setOpen] = useState<string | null>(null);
  const pending = proposals.filter((p) => p.status === 'pending');

  return (
    <Card>
      <div className={page.itemHead}>
        <h2>{project.title}</h2>
        <span className={page.muted}>Budget {formatMoney(project.budget)}</span>
      </div>
      <Notice error={hire.error ?? reject.error} />
      {pending.length === 0 ? (
        <p>No pending proposals yet.</p>
      ) : (
        <ul className={page.list}>
          {pending.map((proposal) => (
            <ProposalItem
              key={proposal.id}
              proposal={proposal}
              title={proposal.workerName ?? 'Worker'}
            >
              <ConfirmAction
                label="Hire"
                confirmLabel="Confirm hire"
                explanation={`Your wallet is charged ${formatMoney(project.budget)} into escrow plus platform fees. Other proposals are closed.`}
                pending={hire.isPending}
                open={open === `hire:${proposal.id}`}
                onOpenChange={(o) => setOpen(o ? `hire:${proposal.id}` : null)}
                onConfirm={() =>
                  hire.mutate(proposal.id, {
                    onSuccess: () => {
                      setOpen(null);
                      onHired(
                        `${proposal.workerName ?? 'The worker'} is hired on “${project.title}”. Escrow is funded.`,
                      );
                    },
                  })
                }
              />
              <ConfirmAction
                label="Reject"
                confirmLabel="Confirm reject"
                explanation="The worker is told their proposal was not accepted."
                danger
                pending={reject.isPending}
                open={open === `reject:${proposal.id}`}
                onOpenChange={(o) =>
                  setOpen(o ? `reject:${proposal.id}` : null)
                }
                onConfirm={() =>
                  reject.mutate(
                    { id: proposal.id, status: 'rejected' },
                    { onSuccess: () => setOpen(null) },
                  )
                }
              />
            </ProposalItem>
          ))}
        </ul>
      )}
    </Card>
  );
}
