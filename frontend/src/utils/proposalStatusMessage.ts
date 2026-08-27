import type { ProposalStatus } from '@/types';

export type ProposalStatusSeverity = 'info' | 'success' | 'warning' | 'error';

export interface ProposalStatusMessage {
  readonly message: string;
  readonly severity: ProposalStatusSeverity;
}

// Plain-English copy for each status a just-submitted proposal can come back
// with. Shared by anywhere that needs to tell the author what happened to
// their submission (currently GlobalProposalStatusSnackbar) — kept in one
// place so the wording never drifts between call sites.
export function proposalStatusMessage(status: ProposalStatus): ProposalStatusMessage {
  switch (status) {
    case 'PENDING':
      return {
        message: 'Your proposal has been submitted and is being checked for conflicts…',
        severity: 'info',
      };
    case 'READY':
      return {
        message:
          "Your proposal is ready for review — it doesn't add any new scheduling conflicts to the published schedule ✓",
        severity: 'success',
      };
    case 'BLOCKED':
      return {
        message:
          'Your proposal has scheduling conflicts — the scheduling office has been notified and will contact you',
        severity: 'warning',
      };
    case 'MERGED':
      return {
        message: 'Your proposal has been merged into the published schedule ✓',
        severity: 'success',
      };
    default:
      return { message: '', severity: 'info' };
  }
}
