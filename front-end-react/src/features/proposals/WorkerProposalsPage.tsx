import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Project, Proposal } from '../../shared/types/domain';
import { EmptyState, Notice, PageHeader, QueryView } from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';
import { useProjects } from '../projects/hooks';
import { ConfirmAction } from '../../shared/ui/ConfirmAction';
import { ProposalItem } from './ProposalItem';
import {
  useAcceptInvitation,
  useCloseProposal,
  useDeclineInvitation,
  useProposals,
} from './hooks';

/** Titles for proposals whose project the worker can still see (open, or hired on). */
function useTitles() {
  const projects = useProjects();
  const byId = new Map((projects.data ?? []).map((p: Project) => [p.id, p]));
  return (proposal: Proposal) =>
    byId.get(proposal.taskId)?.title ?? 'Project no longer open';
}

export function MyProposalsPage() {
  const proposals = useProposals({ type: 'proposal' });
  const title = useTitles();
  const close = useCloseProposal();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <PageHeader title="My proposals" subtitle="Proposals you have sent." />
      <Notice error={close.error} />
      <QueryView query={proposals}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState title="No proposals yet">
              <p>
                <Link to="/worker/browse">Browse open tasks</Link>
              </p>
            </EmptyState>
          ) : (
            <ul className={page.list}>
              {list.map((p) => (
                <ProposalItem key={p.id} proposal={p} title={title(p)}>
                  {p.status === 'hired' && (
                    <Link to={`/project/${p.taskId}/workroom`}>Workroom</Link>
                  )}
                  {p.status === 'pending' && (
                    <>
                      <Link to={`/tasks/${p.taskId}`}>View project</Link>
                      <ConfirmAction
                        label="Withdraw"
                        confirmLabel="Confirm withdraw"
                        explanation="The client will no longer see this proposal."
                        danger
                        pending={close.isPending}
                        open={open === p.id}
                        onOpenChange={(o) => setOpen(o ? p.id : null)}
                        onConfirm={() =>
                          close.mutate(
                            { id: p.id, status: 'withdrawn' },
                            { onSuccess: () => setOpen(null) },
                          )
                        }
                      />
                    </>
                  )}
                </ProposalItem>
              ))}
            </ul>
          )
        }
      </QueryView>
    </>
  );
}

/** Invitations from clients. Accepting starts the contract and funds escrow from the client's wallet. */
export function InvitationsPage() {
  const invitations = useProposals({ type: 'invitation' });
  const title = useTitles();
  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();
  const [open, setOpen] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<string | null>(null);
  return (
    <>
      <PageHeader
        title="Invitations"
        subtitle="Clients who invited you to their projects."
      />
      <Notice
        error={accept.error ?? decline.error}
        success={accepted ? 'Invitation accepted. You are hired.' : null}
      />
      {accepted && (
        <Link to={`/project/${accepted}/workroom`}>Go to the workroom</Link>
      )}
      <QueryView query={invitations}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState title="No invitations" />
          ) : (
            <ul className={page.list}>
              {list.map((inv) => (
                <ProposalItem key={inv.id} proposal={inv} title={title(inv)}>
                  {inv.status === 'pending' && (
                    <>
                      <Link to={`/tasks/${inv.taskId}`}>View project</Link>
                      <ConfirmAction
                        label="Accept"
                        confirmLabel="Confirm accept"
                        explanation="You will be hired on this project."
                        pending={accept.isPending}
                        open={open === `a:${inv.id}`}
                        onOpenChange={(o) => setOpen(o ? `a:${inv.id}` : null)}
                        onConfirm={() =>
                          accept.mutate(inv.id, {
                            onSuccess: () => {
                              setOpen(null);
                              setAccepted(inv.taskId);
                            },
                          })
                        }
                      />
                      <ConfirmAction
                        label="Decline"
                        confirmLabel="Confirm decline"
                        explanation="The client will be able to invite someone else."
                        danger
                        pending={decline.isPending}
                        open={open === `d:${inv.id}`}
                        onOpenChange={(o) => setOpen(o ? `d:${inv.id}` : null)}
                        onConfirm={() =>
                          decline.mutate(inv.id, {
                            onSuccess: () => setOpen(null),
                          })
                        }
                      />
                    </>
                  )}
                  {inv.status === 'hired' && (
                    <Link to={`/project/${inv.taskId}/workroom`}>Workroom</Link>
                  )}
                </ProposalItem>
              ))}
            </ul>
          )
        }
      </QueryView>
    </>
  );
}
