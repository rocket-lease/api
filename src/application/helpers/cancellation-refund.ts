import type { CancellationPolicy } from '@rocket-lease/contracts'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const FLEXIBLE_DEADLINE_HOURS = 24
const MODERATE_DEADLINE_HOURS = 48
const STRICT_MIN_HOURS_BEFORE_START = 48
const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = 'FLEXIBLE'

export interface CancellationRefundInput {
  startAt: Date
  paidAt: Date | null
  totalCents: number
  cancellationPolicy: CancellationPolicy | null | undefined
  now: Date
}

export interface CancellationRefundResult {
  refundCents: number
  deadlineAt: Date | null
  policy: CancellationPolicy | null
}

export function calculateCancellationRefund(
  input: CancellationRefundInput,
): CancellationRefundResult {
  const policy = input.cancellationPolicy ?? DEFAULT_CANCELLATION_POLICY
  if (!input.paidAt) {
    return {
      refundCents: 0,
      deadlineAt: null,
      policy,
    }
  }
  const evaluation = evaluateRefundWindow(policy, input)
  if (!evaluation.eligible) {
    return {
      refundCents: 0,
      deadlineAt: evaluation.deadlineAt,
      policy,
    }
  }

  const refundPercent = policy === 'MODERATE' ? 50 : 100
  return {
    refundCents: Math.floor((input.totalCents * refundPercent) / 100),
    deadlineAt: evaluation.deadlineAt,
    policy,
  }
}

function evaluateRefundWindow(
  policy: CancellationPolicy,
  input: CancellationRefundInput,
): { eligible: boolean; deadlineAt: Date | null } {
  const startAtLimit = new Date(
    input.startAt.getTime() - STRICT_MIN_HOURS_BEFORE_START * HOUR_MS,
  )

  if (policy === 'FLEXIBLE') {
    const deadlineAt = new Date(input.startAt.getTime() - FLEXIBLE_DEADLINE_HOURS * HOUR_MS)
    return {
      eligible: input.now.getTime() <= deadlineAt.getTime(),
      deadlineAt,
    }
  }

  if (policy === 'MODERATE') {
    const deadlineAt = new Date(input.startAt.getTime() - MODERATE_DEADLINE_HOURS * HOUR_MS)
    return {
      eligible: input.now.getTime() <= deadlineAt.getTime(),
      deadlineAt,
    }
  }

  if (!input.paidAt) {
    return {
      eligible: false,
      deadlineAt: null,
    }
  }

  const paidAtLimit = new Date(input.paidAt.getTime() + 7 * DAY_MS)
  const deadlineAt =
    paidAtLimit.getTime() <= startAtLimit.getTime() ? paidAtLimit : startAtLimit
  const eligibleByPaidWindow = input.now.getTime() <= paidAtLimit.getTime()
  const eligibleByStartWindow = input.now.getTime() < startAtLimit.getTime()

  return {
    eligible: eligibleByPaidWindow && eligibleByStartWindow,
    deadlineAt,
  }
}
