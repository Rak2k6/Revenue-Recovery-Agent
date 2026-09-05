const state = {
  metrics: null,
  cases: [],
  selectedCase: null,
  filter: 'all',
  search: '',
  lastUpdated: null,
};

const manualCheckoutState = {
  timeoutId: null,
  razorpayInstance: null,
};

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const percent = (value) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0.00%';
  return `${numeric.toFixed(2)}%`;
};

const formatPaise = (value) => {
  const safeValue = Number(value ?? 0);
  return currency.format(safeValue / 100);
};

const formatProbability = (value) => {
  const safeValue = Number(value ?? 0);
  if (!Number.isFinite(safeValue)) return '0%';
  const percentValue = safeValue <= 1 ? safeValue * 100 : safeValue;
  return `${percentValue.toFixed(0)}%`;
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const formatTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
};

const humanizeEnum = (value, fallback = '—') => {
  if (!value) return fallback;
  return String(value)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const tagClass = (status) => {
  const normalized = String(status || '').toUpperCase();
  if (['RECOVERED', 'COMPLETED'].includes(normalized)) return 'success';
  if (['PENDING_ASSESSMENT', 'PENDING', 'IN_PROGRESS'].includes(normalized)) return 'warning';
  if (['NOT_RECOVERABLE', 'RECOVERY_FAILED', 'FAILED', 'SKIPPED'].includes(normalized)) return 'failure';
  if (['RECOVERABLE'].includes(normalized)) return 'info';
  return 'neutral';
};

const statusMap = {
  PENDING_ASSESSMENT: 'Pending',
  RECOVERABLE: 'Recoverable',
  RECOVERED: 'Recovered',
  RECOVERY_FAILED: 'Recovery Failed',
  NOT_RECOVERABLE: 'Not Recoverable',
  NONE: 'None',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  SKIPPED: 'Skipped',
};

const calculateProbabilityPercent = (value) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return numeric <= 1 ? numeric * 100 : numeric;
};

const formatClock = () => {
  const now = new Date();
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);
};

const getRecoveryLinkUrl = (caseData) => {
  if (!caseData) return '';
  const linkFromCase = caseData.recoveryLinkUrl || '';
  if (linkFromCase) return linkFromCase;

  const fromLogs = (caseData.auditLogs || []).find((log) => {
    const metadata = log?.metadata || {};
    const shortUrl = metadata.shortUrl || metadata.recoveryLinkUrl || metadata.url;
    return typeof shortUrl === 'string' && shortUrl.trim().length > 0;
  });

  if (!fromLogs) return '';
  const metadata = fromLogs.metadata || {};
  return metadata.shortUrl || metadata.recoveryLinkUrl || metadata.url || '';
};

const getCaseNotificationSummary = (caseData) => {
  const logs = [...(caseData?.auditLogs || [])].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const reminderLog = logs.find((log) => log.action === 'RECOVERY_REMINDER_SENT');
  if (!reminderLog) return null;

  const metadata = reminderLog.metadata || {};
  const provider = metadata.provider || 'EMAIL';
  const recipient = metadata.recipientEmail || metadata.email || caseData?.payment?.customer?.email || 'Customer';
  const status = reminderLog.status === 'COMPLETED' ? 'SENT' : (reminderLog.status || 'SENT');

  return {
    title: 'Recovery notification sent',
    method: String(provider).toUpperCase().includes('EMAIL') ? 'EMAIL' : String(provider).toUpperCase(),
    recipient,
    status,
    provider: String(provider).toUpperCase(),
    sentAt: reminderLog.createdAt,
  };
};

const getTopLevelStatus = (value) => {
  if (!value) return 'PENDING_ASSESSMENT';
  return value;
};

const filteredCases = () => {
  const search = state.search.trim().toLowerCase();

  return state.cases.filter((item) => {
    const customerName = item.payment?.customer?.email || 'Unknown customer';
    const searchable = [
      customerName,
      item.payment?.razorpayPaymentId,
      item.id,
      item.failureCategory,
      item.recommendedAction,
    ].join(' ').toLowerCase();

    const matchesSearch = !search || searchable.includes(search);
    const matchesFilter = (() => {
      switch (state.filter) {
        case 'pending': return item.recoverabilityStatus === 'PENDING_ASSESSMENT';
        case 'recoverable': return item.recoverabilityStatus === 'RECOVERABLE';
        case 'recovered': return item.recoverabilityStatus === 'RECOVERED';
        case 'failed': return item.recoverabilityStatus === 'RECOVERY_FAILED';
        case 'not_recoverable': return item.recoverabilityStatus === 'NOT_RECOVERABLE';
        default: return true;
      }
    })();

    return matchesSearch && matchesFilter;
  });
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'Request failed');
  }

  return payload;
};

const setRefreshTimes = () => {
  const now = new Date();
  const formatted = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);

  const text = formatted;
  document.getElementById('lastRefreshText').textContent = text;
  document.getElementById('heroLastRefresh').textContent = text;
};

const renderMetrics = () => {
  const metrics = state.metrics;
  if (!metrics) return;

  document.getElementById('revenueAtRisk').textContent = formatPaise(metrics.revenue?.atRisk || 0);
  document.getElementById('revenueRecovered').textContent = formatPaise(metrics.revenue?.recovered || 0);
  document.getElementById('recoveryRate').textContent = percent(metrics.revenue?.recoveryRate || 0);
  document.getElementById('totalRecoveryCases').textContent = metrics.cases?.total || 0;
  document.getElementById('recoveredCases').textContent = metrics.cases?.recovered || 0;
  document.getElementById('recoverableCases').textContent = metrics.cases?.recoverable || 0;
  document.getElementById('paymentLinksCreated').textContent = metrics.actions?.paymentLinksCreated || 0;
  document.getElementById('failedActions').textContent = metrics.actions?.failed || 0;
  document.getElementById('heroCasesProcessed').textContent = metrics.cases?.total || 0;

  document.getElementById('recoveryFailedCases')?.remove();
  document.getElementById('notRecoverableCases')?.remove();
};

const renderFunnel = () => {
  const metrics = state.metrics;
  if (!metrics) return;

  const total = metrics.cases?.total || 0;
  const recoverable = metrics.cases?.recoverable || 0;
  const recovered = metrics.cases?.recovered || 0;
  const actioned = metrics.actions?.paymentLinksCreated || 0;

  const stages = [
    { label: 'Failed Payments', value: total },
    { label: 'Assessed', value: total },
    { label: 'Recoverable', value: recoverable },
    { label: 'Actioned', value: actioned },
    { label: 'Recovered', value: recovered },
  ];

  const max = Math.max(...stages.map((stage) => stage.value), 1);

  document.getElementById('recoveryFunnel').innerHTML = stages.map((stage) => `
    <div class="funnel-step">
      <div class="funnel-label">${stage.label}</div>
      <div class="funnel-track">
        <div class="funnel-fill" style="width:${(stage.value / max) * 100}%"></div>
      </div>
      <div class="funnel-value">${stage.value}</div>
    </div>
  `).join('');
};

const renderDistribution = () => {
  const metrics = state.metrics;
  if (!metrics) return;

  const total = metrics.cases?.total || 0;
  const items = [
    { label: 'Recovered', value: metrics.cases?.recovered || 0, color: '#127a54' },
    { label: 'Recoverable', value: metrics.cases?.recoverable || 0, color: '#1f5eff' },
    { label: 'Recovery Failed', value: metrics.cases?.recoveryFailed || 0, color: '#c43745' },
    { label: 'Not Recoverable', value: metrics.cases?.notRecoverable || 0, color: '#64748b' },
    { label: 'Pending', value: metrics.cases?.pending || 0, color: '#c87900' },
  ];

  document.getElementById('distributionChart').innerHTML = items.map((item) => {
    const width = total > 0 ? (item.value / total) * 100 : 0;
    return `
      <div class="distribution-item">
        <div class="distribution-label">${item.label}</div>
        <div class="distribution-track">
          <div class="distribution-fill" style="width:${width}%; background:${item.color};"></div>
        </div>
        <div class="distribution-value">${item.value}</div>
      </div>
    `;
  }).join('');
};

const renderAuditTrail = () => {
  const allAudit = state.cases
    .flatMap((item) => (item.auditLogs || []).map((log) => ({
      ...log,
      recoveryCaseId: item.id,
      customer: item.payment?.customer?.email || 'Customer',
      amount: item.revenueAtRisk,
    })))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

  document.getElementById('eligibleCaseCount').textContent = String(state.cases.filter((item) => item.recoverabilityStatus === 'PENDING_ASSESSMENT').length || 0);

  const auditList = document.getElementById('auditTrailList');
  if (!auditList) return;

  if (!allAudit.length) {
    auditList.innerHTML = '<div class="empty-state">No audit events have been recorded yet.</div>';
    return;
  }

  auditList.innerHTML = allAudit.map((log) => `
    <div class="timeline-row">
      <div class="time">${formatTime(log.createdAt)}</div>
      <div class="action">${humanizeEnum(log.action)}</div>
      <div class="amount-meta">${formatPaise(log.amount || 0)}</div>
      <div><span class="tag ${tagClass(log.status)}">${statusMap[log.status] || humanizeEnum(log.status)}</span></div>
      <div class="metadata">${log.customer || 'Customer'} · ${log.recoveryCaseId}</div>
    </div>
  `).join('');
};

const renderCaseTable = () => {
  const rows = filteredCases();
  const tbody = document.getElementById('caseTableBody');

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-state">Your recovery queue is clear.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((item) => {
    const payment = item.payment || {};
    const customer = payment.customer || {};
    const customerEmail = customer.email || 'Unknown customer';
    const status = getTopLevelStatus(item.recoverabilityStatus || 'PENDING_ASSESSMENT');
    const actionStatus = item.actionStatus || 'NONE';
    const initials = (customerEmail.split('@')[0] || 'CU').slice(0, 2).toUpperCase();
    const probability = calculateProbabilityPercent(item.recoveryProbability || 0);

    return `
      <tr data-case-id="${item.id}">
        <td>
          <div class="customer-cell">
            <div class="customer-avatar">${initials}</div>
            <div class="customer-meta">
              <strong>${customerEmail}</strong>
              <small>${formatDate(item.createdAt)}</small>
            </div>
          </div>
        </td>
        <td><span class="payment-pill">${payment.razorpayPaymentId || item.paymentId || '—'}</span></td>
        <td><span class="tag ${tagClass(item.failureCategory)}">${humanizeEnum(item.failureCategory, 'Unknown')}</span></td>
        <td><span class="amount">${formatPaise(item.revenueAtRisk)}</span></td>
        <td>
          <div class="probability">
            <div class="probability-bar"><span class="probability-fill" style="width:${Math.min(probability, 100)}%"></span></div>
            <strong>${formatProbability(item.recoveryProbability)}</strong>
          </div>
        </td>
        <td><span class="tag ${tagClass(item.recommendedAction || 'NONE')}">${humanizeEnum(item.recommendedAction, 'N/A')}</span></td>
        <td><span class="tag ${tagClass(actionStatus)}">${statusMap[actionStatus] || humanizeEnum(actionStatus)}</span></td>
        <td><span class="tag ${tagClass(status)}">${statusMap[status] || humanizeEnum(status)}</span></td>
        <td><button class="inline-case-link" type="button">View Case</button></td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('tr[data-case-id]').forEach((row) => {
    row.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      openCase(row.dataset.caseId);
    });
    row.querySelector('.inline-case-link').addEventListener('click', () => openCase(row.dataset.caseId));
  });
};

const getPolicyOutcome = (caseData) => {
  const logs = caseData.auditLogs || [];
  const rejected = logs.some((log) => ['EXECUTION_REJECTED', 'ACTION_BLOCKED'].includes(log.action));
  const approved = logs.some((log) => ['PAYMENT_LINK_CREATED', 'RECOVERY_REMINDER_SENT', 'ACTION_REQUESTED', 'ACTION_ALREADY_EXISTS'].includes(log.action));

  if (rejected) return { approved: false, reason: 'AI recommendation was blocked by deterministic policy guardrails.' };
  if (approved) return { approved: true, reason: 'AI recommendation was approved and the executor proceeded.' };
  if (caseData.actionStatus === 'FAILED') return { approved: false, reason: 'The action failed after approval and was not allowed to continue.' };
  if (caseData.actionStatus === 'COMPLETED') return { approved: true, reason: 'Action completed successfully under the policy guardrail.' };
  return { approved: null, reason: 'Awaiting policy decision.' };
};

const renderJourney = (caseData) => {
  const logs = caseData.auditLogs || [];
  const stages = [
    { label: 'Payment Failed', complete: true, tag: 'Payment failed' },
    { label: 'Context Built', complete: !!(caseData.reasoning || caseData.recoveryProbability || logs.length), tag: 'Context assembled' },
    { label: 'AI Assessment', complete: !!(caseData.reasoning || logs.some((log) => log.action === 'ASSESSMENT_COMPLETED')), tag: caseData.reasoning ? 'AI assessed' : 'Assessment pending' },
    { label: 'Policy Check', complete: !!(logs.some((log) => ['EXECUTION_REJECTED', 'ACTION_BLOCKED', 'ACTION_REQUESTED', 'PAYMENT_LINK_CREATED'].includes(log.action)) || caseData.stopCondition), tag: caseData.stopCondition || 'Waiting' },
    { label: 'Action Executed', complete: !!(logs.some((log) => ['ACTION_REQUESTED', 'PAYMENT_LINK_CREATED', 'RECOVERY_REMINDER_SENT', 'ACTION_ALREADY_EXISTS'].includes(log.action)) || caseData.actionStatus === 'COMPLETED'), tag: caseData.actionStatus || 'Pending' },
    { label: 'Notification Sent', complete: !!logs.some((log) => log.action === 'RECOVERY_REMINDER_SENT'), tag: 'Notification' },
    { label: 'Recovery Verified', complete: caseData.recoverabilityStatus === 'RECOVERED' || !!logs.some((log) => log.action === 'RECOVERY_SUCCESSFUL'), tag: caseData.recoverabilityStatus === 'RECOVERED' ? 'Customer captured' : 'Awaiting webhook' },
  ];

  const activeIndex = stages.findIndex((stage) => !stage.complete);

  document.getElementById('recoveryJourney').innerHTML = stages.map((stage, index) => {
    const isComplete = stage.complete;
    const isActive = !isComplete && activeIndex === index;
    return `
      <div class="journey-step-item ${isComplete ? 'complete' : isActive ? 'active' : ''}">
        <span class="journey-bullet"></span>
        <div class="journey-copy">
          <strong>${stage.label}</strong>
          <small>${stage.tag}</small>
        </div>
      </div>
    `;
  }).join('');
};

const renderDetail = (caseData) => {
  if (!caseData) return;

  const payment = caseData.payment || {};
  const customer = payment.customer || {};
  const policyOutcome = getPolicyOutcome(caseData);
  const policyBadgeClass = policyOutcome.approved === true ? 'approved' : policyOutcome.approved === false ? 'rejected' : 'pending';
  const policyBadgeText = policyOutcome.approved === true ? '✓ Action Approved' : policyOutcome.approved === false ? '✕ Action Blocked' : 'Awaiting Policy';
  const status = getTopLevelStatus(caseData.recoverabilityStatus || 'PENDING_ASSESSMENT');
  const latestAudit = [...(caseData.auditLogs || [])].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(-1)[0];
  const paymentLinkUrl = getRecoveryLinkUrl(caseData);
  const shouldShowPaymentLink = caseData.actionStatus === 'COMPLETED' && !!paymentLinkUrl && caseData.recoverabilityStatus !== 'RECOVERED';
  const isRecovered = caseData.recoverabilityStatus === 'RECOVERED';
  const notificationSummary = getCaseNotificationSummary(caseData);

  document.getElementById('caseDetailTitle').textContent = `${customer.email || 'Customer'} · ${payment.razorpayPaymentId || caseData.paymentId || '—'}`;
  document.getElementById('caseDetailStatus').innerHTML = `
    <span class="tag ${tagClass(status)}">${statusMap[status] || humanizeEnum(status)}</span>
  `;

  document.getElementById('caseDetailContent').innerHTML = `
    <div class="summary-grid">
      <div class="summary-item">
        <div class="label">Revenue At Risk</div>
        <div class="value">${formatPaise(caseData.revenueAtRisk)}</div>
      </div>
      <div class="summary-item">
        <div class="label">Amount Recovered</div>
        <div class="value">${formatPaise(caseData.amountRecovered || 0)}</div>
      </div>
      <div class="summary-item">
        <div class="label">Recovery Probability</div>
        <div class="value">${formatProbability(caseData.recoveryProbability)}</div>
      </div>
      <div class="summary-item">
        <div class="label">Priority</div>
        <div class="value">${(caseData.priority || 'MEDIUM').toUpperCase()}</div>
      </div>
      <div class="summary-item">
        <div class="label">Attempts</div>
        <div class="value">${caseData.recoveryAttemptCount || 0}</div>
      </div>
      <div class="summary-item">
        <div class="label">Maximum Attempts</div>
        <div class="value">${caseData.maxRecoveryAttempts || 0}</div>
      </div>
    </div>

    <div class="detail-two-col">
      <div class="info-card">
        <h4>AI Recovery Assessment</h4>
        <dl class="info-list">
          <div class="info-row"><dt>Recovery Probability</dt><dd>${formatProbability(caseData.recoveryProbability)}</dd></div>
          <div class="info-row"><dt>Recommended Action</dt><dd>${humanizeEnum(caseData.recommendedAction, 'N/A')}</dd></div>
          <div class="info-row"><dt>Preferred Method</dt><dd>${humanizeEnum(caseData.preferredMethod, 'N/A')}</dd></div>
          <div class="info-row"><dt>Confidence</dt><dd>${Number(caseData.confidence || 0).toFixed(2)}</dd></div>
        </dl>
        <div class="reasoning-box">${caseData.reasoning || 'No AI reasoning available for this case yet.'}</div>
      </div>

      <div class="info-card">
        <h4>Policy Guardrail</h4>
        <div class="policy-status-badge ${policyBadgeClass}">${policyBadgeText}</div>
        <dl class="info-list" style="margin-top: 12px;">
          <div class="info-row"><dt>Attempts</dt><dd>${caseData.recoveryAttemptCount || 0} / ${caseData.maxRecoveryAttempts || 0}</dd></div>
          <div class="info-row"><dt>Stop Condition</dt><dd>${caseData.stopCondition || '—'}</dd></div>
          <div class="info-row"><dt>Action Status</dt><dd>${statusMap[caseData.actionStatus] || humanizeEnum(caseData.actionStatus)}</dd></div>
        </dl>
        <div class="reasoning-box">${policyOutcome.reason}</div>
      </div>
    </div>

    ${isRecovered ? `
      <div class="info-card" style="margin-top: 18px;">
        <h4>Recovery Verification</h4>
        <div class="run-button-row" style="align-items:center; gap:12px;">
          <div>
            <strong>✓ RECOVERY VERIFIED</strong>
            <div style="font-size: 0.78rem; color: var(--muted); margin-top: 4px;">Amount Recovered: ${formatPaise(caseData.amountRecovered || 0)}</div>
          </div>
          <span class="tag ${tagClass(status)}">${formatPaise(caseData.amountRecovered || 0)} RECOVERED</span>
        </div>
      </div>
    ` : shouldShowPaymentLink ? `
      <div class="info-card" style="margin-top: 18px;">
        <h4>RECOVERY LINK CREATED</h4>
        <div class="run-button-row" style="align-items:center; gap:12px;">
          <div>
            <strong>Amount: ${formatPaise(caseData.revenueAtRisk)}</strong>
            <div style="font-size: 0.78rem; color: var(--muted); margin-top: 4px;">Status: Awaiting Customer Payment</div>
          </div>
          <button id="openPaymentLinkButton" class="button button-primary" type="button">Open Payment Link</button>
        </div>
      </div>
    ` : ''}

    ${notificationSummary ? `
      <div class="info-card" style="margin-top: 18px;">
        <h4>Notification Activity</h4>
        <div class="run-button-row" style="align-items:center; gap:12px;">
          <div>
            <strong>${notificationSummary.title}</strong>
            <div style="font-size: 0.78rem; color: var(--muted); margin-top: 4px;">Method: ${notificationSummary.method} · Recipient: ${notificationSummary.recipient}</div>
          </div>
          <span class="tag ${tagClass(notificationSummary.status)}">${notificationSummary.status}</span>
        </div>
      </div>
    ` : ''}

    <div class="info-card">
      <h4>Recovery Journey</h4>
      <div id="recoveryJourney" class="journey-list"></div>
    </div>

    <div class="info-card" style="margin-top: 18px;">
      <h4>Audit Trail</h4>
      <div class="timeline-list">
        ${(caseData.auditLogs || []).length ? (caseData.auditLogs || []).slice().reverse().map((log) => `
          <div class="timeline-row">
            <div class="time">${formatTime(log.createdAt)}</div>
            <div class="action">${humanizeEnum(log.action)}</div>
            <div><span class="tag ${tagClass(log.status)}">${statusMap[log.status] || humanizeEnum(log.status)}</span></div>
          </div>
        `).join('') : '<div class="empty-state">No audit data available for this case.</div>'}
      </div>
    </div>

    <div class="action-panel">
      <h4 style="margin:0 0 8px; font-size: 0.76rem; letter-spacing:0.08em; text-transform:uppercase; color: var(--muted);">Execution</h4>
      <div class="run-button-row">
        <div>
          <strong>${latestAudit ? humanizeEnum(latestAudit.action) : 'No audit event recorded'}</strong>
        </div>
        <button id="runRecoveryButton" class="button button-primary" type="button">Run Recovery</button>
      </div>
    </div>
  `;

  renderJourney(caseData);

  const recoveryButton = document.getElementById('runRecoveryButton');
  if (recoveryButton) {
    recoveryButton.disabled = caseData.recoverabilityStatus === 'RECOVERED' || caseData.actionStatus === 'IN_PROGRESS';
    recoveryButton.addEventListener('click', () => runRecovery(caseData.id));
  }

  const paymentLinkButton = document.getElementById('openPaymentLinkButton');
  if (paymentLinkButton && paymentLinkUrl) {
    paymentLinkButton.addEventListener('click', () => {
      window.open(paymentLinkUrl, '_blank', 'noopener,noreferrer');
      showToast('Opened recovery payment link in a new tab.');
    });
  }
};

const openCase = async (caseId) => {
  try {
    const details = await fetchJson(`/api/recovery-cases/${caseId}`);
    state.selectedCase = details.data;
    document.getElementById('drawerBackdrop').classList.add('open');
    document.getElementById('detailDrawer').classList.add('open');
    renderDetail(state.selectedCase);
  } catch (error) {
    showToast(error.message || 'Unable to load recovery case.');
  }
};

const closeDrawer = () => {
  document.getElementById('drawerBackdrop').classList.remove('open');
  document.getElementById('detailDrawer').classList.remove('open');
};

const runRecovery = async (caseId) => {
  const recoveryButton = document.getElementById('runRecoveryButton');
  if (!recoveryButton) return;

  recoveryButton.disabled = true;
  recoveryButton.textContent = 'Agent is evaluating...';

  try {
    const response = await fetchJson(`/api/recovery-cases/${caseId}/execute`, { method: 'POST' });
    showToast(response.message || 'Recovery action executed.');
    await refreshDashboard();
    await openCase(caseId);
  } catch (error) {
    showToast(error.message || 'Recovery action failed.');
    await refreshDashboard();
    await openCase(caseId);
  } finally {
    if (document.getElementById('runRecoveryButton')) {
      document.getElementById('runRecoveryButton').textContent = 'Run Recovery';
      document.getElementById('runRecoveryButton').disabled = false;
    }
  }
};

const runBatchRecovery = async () => {
  const batchButtons = document.querySelectorAll('.batch-trigger');
  if (!batchButtons.length) {
    const primaryButton = document.createElement('button');
    primaryButton.className = 'button button-primary batch-trigger';
    primaryButton.textContent = 'Run Batch Recovery';
    primaryButton.addEventListener('click', runBatchRecovery);
    return;
  }

  batchButtons.forEach((button) => {
    button.disabled = true;
    button.textContent = 'Processing recovery cases...';
  });

  try {
    const response = await fetchJson('/api/recovery-cases/batch-run', {
      method: 'POST',
      body: JSON.stringify({ limit: 25 }),
    });

    showToast(`Batch recovery complete: ${response.processed || 0} cases processed.`);
    await refreshDashboard();
  } catch (error) {
    showToast(error.message || 'Batch recovery failed.');
  } finally {
    batchButtons.forEach((button) => {
      button.textContent = 'Run Batch Recovery';
      button.disabled = false;
    });
  }
};

const refreshDashboard = async () => {
  const refreshButton = document.getElementById('refreshButton');
  if (refreshButton) refreshButton.disabled = true;

  try {
    const [metrics, cases] = await Promise.all([
      fetchJson('/api/recovery-cases/metrics'),
      fetchJson('/api/recovery-cases'),
    ]);

    state.metrics = metrics;
    state.cases = cases.data || [];
    state.lastUpdated = new Date();
    setRefreshTimes();
    renderMetrics();
    renderFunnel();
    renderDistribution();
    renderAuditTrail();
    renderCaseTable();
  } catch (error) {
    showToast(error.message || 'Recovery data unavailable.');
  } finally {
    if (refreshButton) refreshButton.disabled = false;
  }
};

const setManualPaymentState = (status, message) => {
  const badge = document.getElementById('manualPaymentState');
  const result = document.getElementById('manualPaymentResult');
  if (!badge || !result) return;

  const normalized = String(status || 'IDLE').toUpperCase();
  const labels = {
    IDLE: 'IDLE',
    INITIATING: 'INITIATING',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    ABANDONED: 'ABANDONED',
    TIMEOUT: 'TIMEOUT',
  };

  badge.textContent = labels[normalized] || 'IDLE';
  badge.className = `manual-state manual-state-${normalized.toLowerCase()}`;
  result.textContent = message || 'No test payment started.';
};

const clearManualPaymentTimeout = () => {
  if (manualCheckoutState.timeoutId) {
    clearTimeout(manualCheckoutState.timeoutId);
    manualCheckoutState.timeoutId = null;
  }
};

const handleManualPayment = async () => {
  const button = document.getElementById('manualPaymentButton');
  if (!button) return;

  if (!window.Razorpay) {
    setManualPaymentState('FAILED', 'Razorpay Checkout library is unavailable.');
    showToast('Razorpay Checkout library is unavailable.');
    return;
  }

  button.disabled = true;
  button.textContent = 'Opening Checkout...';
  setManualPaymentState('INITIATING', 'Preparing Razorpay order...');

  try {
    const keyResponse = await fetchJson('/get-razorpay-key');
    const keyId = keyResponse.keyId || keyResponse.key_id;
    if (!keyId) {
      throw new Error('Razorpay key not configured.');
    }

    const order = await fetchJson('/create-order', {
      method: 'POST',
      body: JSON.stringify({ amount: 50000 }),
    });

    const amount = Number(order?.amount || 50000);
    const options = {
      key: keyId,
      amount,
      currency: 'INR',
      name: 'Booking Demo',
      description: 'Test Transaction',
      order_id: order.id,
      handler: async function (response) {
        clearManualPaymentTimeout();
        setManualPaymentState('INITIATING', 'Verifying payment signature...');

        try {
          const verification = await fetchJson('/verify-payment', {
            method: 'POST',
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          setManualPaymentState('SUCCESS', verification.message || 'Payment verified successfully.');
          showToast(verification.message || 'Payment verified successfully.');
        } catch (error) {
          setManualPaymentState('FAILED', error.message || 'Signature verification failed.');
          showToast(error.message || 'Signature verification failed.');
        } finally {
          button.disabled = false;
          button.textContent = 'Book Now';
          manualCheckoutState.razorpayInstance = null;
        }
      },
      prefill: {
        name: 'Test User',
        email: 'test@example.com',
        contact: '9999999999',
      },
      modal: {
        ondismiss: function () {
          clearManualPaymentTimeout();
          setManualPaymentState('ABANDONED', 'Checkout was dismissed by the user.');
          showToast('Checkout was abandoned.');
          button.disabled = false;
          button.textContent = 'Book Now';
          manualCheckoutState.razorpayInstance = null;
        },
      },
    };

    clearManualPaymentTimeout();
    manualCheckoutState.timeoutId = setTimeout(() => {
      if (manualCheckoutState.razorpayInstance) {
        setManualPaymentState('TIMEOUT', 'Checkout timed out before payment completed.');
        showToast('Checkout timed out.');
        button.disabled = false;
        button.textContent = 'Book Now';
      }
    }, 120000);

    const rzp = new window.Razorpay(options);
    manualCheckoutState.razorpayInstance = rzp;

    rzp.on('payment.failed', function (response) {
      clearManualPaymentTimeout();
      const description = response?.error?.description || 'Payment failed.';
      setManualPaymentState('FAILED', description);
      showToast(description);
      button.disabled = false;
      button.textContent = 'Book Now';
      manualCheckoutState.razorpayInstance = null;
    });

    rzp.open();
  } catch (error) {
    setManualPaymentState('FAILED', error.message || 'Unable to start Razorpay Checkout.');
    showToast(error.message || 'Unable to start Razorpay Checkout.');
    button.disabled = false;
    button.textContent = 'Book Now';
  }
};

const showToast = (message) => {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => toast.classList.remove('show'), 2800);
};

document.addEventListener('DOMContentLoaded', async () => {
  const refreshButton = document.getElementById('refreshButton');
  if (refreshButton) refreshButton.addEventListener('click', refreshDashboard);

  document.getElementById('drawerBackdrop').addEventListener('click', closeDrawer);
  document.getElementById('closeDrawer').addEventListener('click', closeDrawer);

  const batchButtons = document.querySelectorAll('.batch-trigger');
  batchButtons.forEach((button) => {
    button.addEventListener('click', runBatchRecovery);
  });

  document.querySelectorAll('.chip').forEach((button) => {
    button.addEventListener('click', () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll('.chip').forEach((chip) => chip.classList.toggle('active', chip === button));
      renderCaseTable();
    });
  });

  document.getElementById('searchInput').addEventListener('input', (event) => {
    state.search = event.target.value;
    renderCaseTable();
  });

  const manualPaymentButton = document.getElementById('manualPaymentButton');
  if (manualPaymentButton) {
    manualPaymentButton.addEventListener('click', handleManualPayment);
  }

  setManualPaymentState('IDLE', 'No test payment started.');
  setRefreshTimes();
  await refreshDashboard();
});
