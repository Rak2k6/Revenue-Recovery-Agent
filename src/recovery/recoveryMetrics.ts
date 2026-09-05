import { prisma } from '../db/prismaClient';

export interface CaseMetrics {
  total: number;
  pending: number;
  recoverable: number;
  recovered: number;
  recoveryFailed: number;
  notRecoverable: number;
}

export interface RevenueMetrics {
  atRisk: number;
  recovered: number;
  recoveryRate: number;
}

export interface CaseRecoveryMetrics {
  eligibleCases: number;
  caseRecoveryRate: number;
}

export interface ActionMetrics {
  paymentLinksCreated: number;
  remindersSent: number;
  failed: number;
  skipped: number;
}

export interface RecoveryMetricsResponse {
  success: boolean;
  cases: CaseMetrics;
  revenue: RevenueMetrics;
  recovery: CaseRecoveryMetrics;
  actions: ActionMetrics;
}

/**
 * Phase 3E — Revenue Recovery Metrics Service.
 *
 * Calculates aggregate recovery metrics directly from database records without
 * introducing separate analytics models or tables.
 */
export async function getRecoveryMetrics(): Promise<RecoveryMetricsResponse> {
  const statusGroups = await prisma.recoveryCase.groupBy({
    by: ['recoverabilityStatus'],
    _count: { _all: true },
  });

  const statusMap: Record<string, number> = {
    PENDING_ASSESSMENT: 0,
    RECOVERABLE: 0,
    RECOVERED: 0,
    RECOVERY_FAILED: 0,
    NOT_RECOVERABLE: 0,
  };

  let totalCases = 0;
  for (const group of statusGroups) {
    statusMap[group.recoverabilityStatus] = group._count._all;
    totalCases += group._count._all;
  }

  const pending = statusMap.PENDING_ASSESSMENT || 0;
  const recoverable = statusMap.RECOVERABLE || 0;
  const recovered = statusMap.RECOVERED || 0;
  const recoveryFailed = statusMap.RECOVERY_FAILED || 0;
  const notRecoverable = statusMap.NOT_RECOVERABLE || 0;

  const revenueAggregate = await prisma.recoveryCase.aggregate({
    _sum: {
      revenueAtRisk: true,
      amountRecovered: true,
    },
  });

  const revenueAtRisk = revenueAggregate._sum.revenueAtRisk ?? 0;
  const revenueRecovered = revenueAggregate._sum.amountRecovered ?? 0;

  const revenueRecoveryRate =
    revenueAtRisk > 0 ? Number(((revenueRecovered / revenueAtRisk) * 100).toFixed(2)) : 0;

  // Eligible cases definition: RECOVERABLE + RECOVERED + RECOVERY_FAILED
  const eligibleCases = recoverable + recovered + recoveryFailed;

  const caseRecoveryRate =
    eligibleCases > 0 ? Number(((recovered / eligibleCases) * 100).toFixed(2)) : 0;

  const [paymentLinksCreated, remindersSent, failedActions, skippedActions] = await Promise.all([
    prisma.recoveryAuditLog.count({ where: { action: 'PAYMENT_LINK_CREATED' } }),
    prisma.recoveryAuditLog.count({ where: { action: 'RECOVERY_REMINDER_SENT' } }),
    prisma.recoveryAuditLog.count({ where: { status: 'FAILED' } }),
    prisma.recoveryAuditLog.count({ where: { status: 'SKIPPED' } }),
  ]);

  return {
    success: true,
    cases: {
      total: totalCases,
      pending,
      recoverable,
      recovered,
      recoveryFailed,
      notRecoverable,
    },
    revenue: {
      atRisk: revenueAtRisk,
      recovered: revenueRecovered,
      recoveryRate: revenueRecoveryRate,
    },
    recovery: {
      eligibleCases,
      caseRecoveryRate,
    },
    actions: {
      paymentLinksCreated,
      remindersSent,
      failed: failedActions,
      skipped: skippedActions,
    },
  };
}
