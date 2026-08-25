/**
 * Where the API lives.
 *
 * Read from the environment so a deployed build can reach a deployed API —
 * this was hardcoded to localhost, which meant the frontend could physically
 * never talk to anything but a developer's own machine.
 *
 * NEXT_PUBLIC_ is required: this runs in the browser, so the value is inlined
 * at build time and is public by definition. Never put a secret here.
 *
 * The localhost fallback keeps `npm run dev` working with no setup. It is a
 * default, not a secret, and a deployed build that forgets the variable will
 * fail loudly in the browser console rather than silently talk to the wrong
 * host.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') ??
  'http://127.0.0.1:8000/api/v1';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/auth/login`,
    REGISTER: `${API_BASE_URL}/auth/register`,
    ME: `${API_BASE_URL}/auth/me`,
    // Credentials go in the body, never the query string.
    CHANGE_PASSWORD: `${API_BASE_URL}/auth/change-password`,
  },
  INVOICES: {
    LIST: `${API_BASE_URL}/invoices`,
    DETAIL: (id: string) => `${API_BASE_URL}/invoices/${id}`,
    UPLOAD: `${API_BASE_URL}/invoices/upload`,
    SUBMIT: (id: string) => `${API_BASE_URL}/invoices/${id}/submit`,
    APPROVE: (id: string) => `${API_BASE_URL}/invoices/${id}/approve`,
    REJECT: (id: string) => `${API_BASE_URL}/invoices/${id}/reject`,
    MARK_PAID: (id: string) => `${API_BASE_URL}/invoices/${id}/mark-paid`,
  },
  CHATBOT: {
    LIST: `${API_BASE_URL}/conversation/list`,
    MESSAGES: (id: string) => `${API_BASE_URL}/conversation/messages/${id}`,
    DELETE: (id: string) => `${API_BASE_URL}/conversation/delete/${id}`,
    CHAT: `${API_BASE_URL}/conversation/chat`,
    QUERY: `${API_BASE_URL}/conversation/query`,
    DETECT_DUPLICATE: `${API_BASE_URL}/conversation/detect-duplicate`,
  },
  DUPLICATES: {
    CHECK: `${API_BASE_URL}/invoices/check-duplicate`,
  },

  // --- Governance surfaces (post-MVP) ---------------------------------------
  INBOX: {
    LIST: `${API_BASE_URL}/inbox`,
    ESCALATE_OVERDUE: `${API_BASE_URL}/inbox/escalate-overdue`,
  },
  AGENT: {
    // Suggestion-only: never auto-execute the returned action.
    NEXT_ACTION: (id: string) => `${API_BASE_URL}/invoices/${id}/next-action`,
  },
  AUDIT: {
    TIMELINE: (type: string, id: string) => `${API_BASE_URL}/audit/timeline/${type}/${id}`,
    VERIFY: (type: string, id: string) => `${API_BASE_URL}/audit/verify/${type}/${id}`,
    AI_ACTIONS: `${API_BASE_URL}/audit/ai-actions`,
    POLICY_EVALS: `${API_BASE_URL}/audit/policy-evals`,
    CHAIN: (correlationId: string) => `${API_BASE_URL}/audit/chain/${correlationId}`,
    // GET previews the bundle without recording it; POST seals and records it.
    EVIDENCE_PACK: (correlationId: string) => `${API_BASE_URL}/audit/evidence-pack/${correlationId}`,
    EVIDENCE_PACKS: `${API_BASE_URL}/audit/evidence-packs`,
    // The pack as a file. html is readable and prints to PDF; json is the
    // canonical bundle. The hash seals the JSON, and the html embeds that
    // JSON verbatim so the seal can be recomputed from the file itself.
    EVIDENCE_PACK_EXPORT: (correlationId: string, format: 'html' | 'json' = 'html') =>
      `${API_BASE_URL}/audit/evidence-pack/${correlationId}/export?format=${format}`,
  },
  VENDORS: {
    LIST: `${API_BASE_URL}/vendors`,
    REVIEW_QUEUE: `${API_BASE_URL}/vendors/review-queue`,
    SET_STATUS: (id: string) => `${API_BASE_URL}/vendors/${id}/status`,
    // Bank details never change through PATCH /vendors/{id} — the server
    // refuses those fields. They move through a request a second person
    // approves, then a cooling period, then an explicit apply.
    BANK_CHANGES: `${API_BASE_URL}/vendors/bank-changes`,
    REQUEST_BANK_CHANGE: (id: string) => `${API_BASE_URL}/vendors/${id}/bank-change`,
    APPROVE_BANK_CHANGE: (id: string) =>
      `${API_BASE_URL}/vendors/bank-changes/${id}/approve`,
    APPLY_BANK_CHANGE: (id: string) =>
      `${API_BASE_URL}/vendors/bank-changes/${id}/apply`,
    REJECT_BANK_CHANGE: (id: string) =>
      `${API_BASE_URL}/vendors/bank-changes/${id}/reject`,
    CANCEL_BANK_CHANGE: (id: string) =>
      `${API_BASE_URL}/vendors/bank-changes/${id}/cancel`,
  },
  // Change watchlist: the three kinds of change that move money or move the
  // rules without touching an invoice. Needs watchlist.view.
  WATCHLIST: {
    LIST: `${API_BASE_URL}/watchlist`,
    ACKNOWLEDGE: (id: string) => `${API_BASE_URL}/watchlist/${id}/acknowledge`,
  },
  // The notification outbox. Messages are queued in the action's transaction
  // and delivered by a scheduler; these endpoints are for seeing that it is
  // actually moving. Needs workflow.manage (admin).
  NOTIFICATIONS: {
    DISPATCH: `${API_BASE_URL}/notifications/dispatch`,
    QUEUE: `${API_BASE_URL}/notifications/queue`,
    SUMMARY: `${API_BASE_URL}/notifications/queue/summary`,
    RETRY_FAILED: `${API_BASE_URL}/notifications/queue/retry-failed`,
    // Your own notifications. Scoped to the caller server-side, so there is
    // no id to pass and no way to point these at somebody else.
    MINE: `${API_BASE_URL}/notifications/mine`,
    MARK_READ: (id: string) => `${API_BASE_URL}/notifications/mine/${id}/read`,
    MARK_ALL_READ: `${API_BASE_URL}/notifications/mine/read-all`,
  },
  CONFIG: {
    APPROVAL_POLICIES: `${API_BASE_URL}/config/approval-policies`,
    SIMULATE: `${API_BASE_URL}/config/approval-policies/simulate`,
    WORKFLOW_STATES: (type: string) => `${API_BASE_URL}/config/workflow/${type}/states`,
    AUTOPILOT: `${API_BASE_URL}/config/autopilot`,
    VERSIONS: (type: string, key: string) => `${API_BASE_URL}/config/versions/${type}/${key}`,
    RESTORE: (type: string, key: string, version: number) =>
      `${API_BASE_URL}/config/versions/${type}/${key}/${version}/restore`,
  },
  AUTOPILOT: {
    PREVIEW: `${API_BASE_URL}/autopilot/preview`,
    RUN: `${API_BASE_URL}/autopilot/run`,
    REVERT: (id: string) => `${API_BASE_URL}/autopilot/${id}/revert`,
  },
  // HR (Build Book Variant C). Salary, national ID and bank details come back
  // masked unless the caller holds hr.view_compensation — the keys are present
  // either way, so nothing has to branch on which shape it received.
  HR: {
    EMPLOYEES: `${API_BASE_URL}/hr/employees`,
    EMPLOYEE: (id: string) => `${API_BASE_URL}/hr/employees/${id}`,
    LINK_USER: (id: string) => `${API_BASE_URL}/hr/employees/${id}/user`,
    SET_STATUS: (id: string) => `${API_BASE_URL}/hr/employees/${id}/status`,
    TASKS: (id: string) => `${API_BASE_URL}/hr/employees/${id}/tasks`,
    CHECKLIST: (id: string) => `${API_BASE_URL}/hr/employees/${id}/checklist`,
    TASK_STATUS: (taskId: string) => `${API_BASE_URL}/hr/tasks/${taskId}/status`,
    // Who has left and can still sign in — the question an auditor asks.
    OUTSTANDING_ACCESS: `${API_BASE_URL}/hr/outstanding-access`,
    ONBOARDING_COMPLETION: `${API_BASE_URL}/hr/onboarding-completion`,
    HEADCOUNT: `${API_BASE_URL}/hr/headcount`,
    HEADCOUNT_ACTION: (id: string, action: string) =>
      `${API_BASE_URL}/hr/headcount/${id}/${action}`,
    HEADCOUNT_PLAN: `${API_BASE_URL}/hr/headcount-plan`,
    PAYROLL_CHANGES: `${API_BASE_URL}/hr/payroll-changes`,
    PAYROLL_ACTION: (id: string, action: string) =>
      `${API_BASE_URL}/hr/payroll-changes/${id}/${action}`,
    EXPENSES: `${API_BASE_URL}/hr/expenses`,
    EXPENSE_APPROVE: (id: string) => `${API_BASE_URL}/hr/expenses/${id}/approve`,
    EXPENSE_ACTION: (id: string, action: string) =>
      `${API_BASE_URL}/hr/expenses/${id}/${action}`,
  },
  // Inventory (Build Book Variant D1). Stock is a ledger: MOVEMENTS is why a
  // balance is what it is, which a stored quantity can never answer.
  INVENTORY: {
    ITEMS: `${API_BASE_URL}/inventory/items`,
    ITEM: (id: string) => `${API_BASE_URL}/inventory/items/${id}`,
    LOCATIONS: `${API_BASE_URL}/inventory/locations`,
    STOCK: `${API_BASE_URL}/inventory/stock`,
    MOVEMENTS: `${API_BASE_URL}/inventory/movements`,
    RECONCILE: `${API_BASE_URL}/inventory/reconcile`,
    ADJUSTMENTS: `${API_BASE_URL}/inventory/adjustments`,
    ADJUSTMENT: (id: string) => `${API_BASE_URL}/inventory/adjustments/${id}`,
    // One route for both signatures — the server decides whether a call is the
    // first or the second, so a client can never supply the second alone.
    ADJUSTMENT_ACTION: (id: string, action: string) =>
      `${API_BASE_URL}/inventory/adjustments/${id}/${action}`,
    RETURNS: `${API_BASE_URL}/inventory/returns`,
    RETURN_ACTION: (id: string, action: string) =>
      `${API_BASE_URL}/inventory/returns/${id}/${action}`,
    UNINSPECTED: `${API_BASE_URL}/inventory/uninspected`,
    QUALITY_CHECK: (lineId: string) =>
      `${API_BASE_URL}/inventory/receipt-lines/${lineId}/quality-check`,
    EXCEPTION: (lineId: string) =>
      `${API_BASE_URL}/inventory/receipt-lines/${lineId}/exception`,
  },
  // Org units and the scopes a role is exercised within. A user with no scope
  // assigned sees the whole tenant, which is the default until one is given —
  // so an empty list here means unrestricted, not "nothing".
  ORG_UNITS: {
    LIST: `${API_BASE_URL}/org-units`,
    CREATE: `${API_BASE_URL}/org-units`,
    SCOPES: (userId: string) => `${API_BASE_URL}/org-units/users/${userId}/scopes`,
    ASSIGN: (userId: string) => `${API_BASE_URL}/org-units/users/${userId}/scopes`,
    REVOKE: (userId: string, unitId: string) =>
      `${API_BASE_URL}/org-units/users/${userId}/scopes/${unitId}`,
  },
  // The admin console's error monitor. Leads with whether the scheduled jobs
  // are running at all, because a job that stopped raises nothing anywhere.
  SYSTEM: {
    HEALTH: `${API_BASE_URL}/system/health`,
  },
  // The tenant's own accounting system. Sarmaya pushes journal entries out
  // after money has moved and pulls the chart of accounts and party list back
  // on demand — never a continuous two-way sync. See DR-049.
  INTEGRATIONS: {
    // Returns { authorization_url }. Navigate there with window.location.href,
    // NOT apiFetch: the browser has to actually leave the app for Intuit's
    // consent screen, and a redirect followed inside fetch is swallowed.
    CONNECT: (provider: string) =>
      `${API_BASE_URL}/integrations/${provider}/connect`,
    DISCONNECT: (provider: string) =>
      `${API_BASE_URL}/integrations/${provider}/disconnect`,
    // Re-pulls accounts and parties. A wholesale replace, not a merge.
    REFRESH: (provider: string) =>
      `${API_BASE_URL}/integrations/${provider}/refresh`,
    STATUS: (provider: string) =>
      `${API_BASE_URL}/integrations/${provider}/status`,
    // Which accounts a posted entry debits and credits. Nothing posts until
    // these are set — the backend treats an unconfigured connection the same
    // as no connection at all.
    DEFAULT_ACCOUNTS: (provider: string) =>
      `${API_BASE_URL}/integrations/${provider}/default-accounts`,
    ACCOUNTS: (provider: string) =>
      `${API_BASE_URL}/integrations/${provider}/accounts`,
    PARTIES: (provider: string, type?: string) =>
      `${API_BASE_URL}/integrations/${provider}/parties${type ? `?type=${type}` : ''}`,
    MAP_VENDOR: (provider: string, vendorId: string) =>
      `${API_BASE_URL}/integrations/${provider}/vendors/${vendorId}/map`,
    // The outbound queue. `status=failed` is the dead-letter view.
    POSTS: (provider: string, status?: string) =>
      `${API_BASE_URL}/integrations/${provider}/posts${status ? `?status=${status}` : ''}`,
    RETRY_POST: (provider: string, postId: string) =>
      `${API_BASE_URL}/integrations/${provider}/posts/${postId}/retry`,
  },
  USERS: {
    // Directory for the delegate picker; requires users.view.
    LIST: `${API_BASE_URL}/users`,
    // Role changes require users.manage and are never self-service.
    SET_ROLE: (id: string) => `${API_BASE_URL}/users/${id}/role`,
  },
  DASHBOARD: {
    // The seven Build Book dashboards, computed from history rather than from
    // counters. OVERVIEW returns all seven in one call.
    OVERVIEW: `${API_BASE_URL}/dashboard/overview`,
    CONTROL_ROOM: `${API_BASE_URL}/dashboard/control-room`,
    BOTTLENECKS: `${API_BASE_URL}/dashboard/bottlenecks`,
    EXCEPTIONS: `${API_BASE_URL}/dashboard/exceptions`,
    POLICY_OVERRIDES: `${API_BASE_URL}/dashboard/policy-overrides`,
    EVIDENCE: `${API_BASE_URL}/dashboard/evidence`,
    RECONCILIATION_HEALTH: `${API_BASE_URL}/dashboard/reconciliation-health`,
    AUTOPILOT_HEALTH: `${API_BASE_URL}/dashboard/autopilot-health`,
    // Variant D reports.
    STOCK_ACCURACY: `${API_BASE_URL}/dashboard/stock-accuracy`,
    SUPPLIER_PERFORMANCE: `${API_BASE_URL}/dashboard/supplier-performance`,
    RECEIPT_TO_INVOICE: `${API_BASE_URL}/dashboard/receipt-to-invoice`,
    // Variant C reports.
    HIRING_PIPELINE: `${API_BASE_URL}/dashboard/hiring-pipeline`,
    PAYROLL_VARIANCE: `${API_BASE_URL}/dashboard/payroll-variance`,
    EXPENSE_EXCEPTIONS: `${API_BASE_URL}/dashboard/expense-exceptions`,
    // Any of the seven as a file. csv carries one table (the report's largest
    // unless `table` names another); html carries the whole report and prints
    // to PDF from any browser.
    EXPORT: (report: string, format: 'csv' | 'html' | 'json' = 'csv', table?: string) =>
      `${API_BASE_URL}/dashboard/${report}/export?format=${format}`
      + (table ? `&table=${encodeURIComponent(table)}` : ''),
    // Headline figures: pending approvals, this month's volume, top vendors.
    STATS: `${API_BASE_URL}/dashboard/stats`,
    // The pending invoices themselves, so the count is actionable rather than
    // something you have to go and find.
    PENDING: `${API_BASE_URL}/dashboard/pending`,
  },
  REQUISITIONS: {
    LIST: `${API_BASE_URL}/requisitions`,
    CREATE: `${API_BASE_URL}/requisitions`,
    DETAIL: (id: string) => `${API_BASE_URL}/requisitions/${id}`,
    SUBMIT: (id: string) => `${API_BASE_URL}/requisitions/${id}/submit`,
    APPROVE: (id: string) => `${API_BASE_URL}/requisitions/${id}/approve`,
    REJECT: (id: string) => `${API_BASE_URL}/requisitions/${id}/reject`,
    CANCEL: (id: string) => `${API_BASE_URL}/requisitions/${id}/cancel`,
  },
  RFQS: {
    LIST: `${API_BASE_URL}/rfqs`,
    CREATE: `${API_BASE_URL}/rfqs`,
    DETAIL: (id: string) => `${API_BASE_URL}/rfqs/${id}`,
    INVITE: (id: string) => `${API_BASE_URL}/rfqs/${id}/vendors`,
    ISSUE: (id: string) => `${API_BASE_URL}/rfqs/${id}/issue`,
    QUOTES: (id: string) => `${API_BASE_URL}/rfqs/${id}/quotes`,
    // Quotes lock here — nothing may be added or altered afterwards.
    CLOSE: (id: string) => `${API_BASE_URL}/rfqs/${id}/close`,
    COMPARISON: (id: string) => `${API_BASE_URL}/rfqs/${id}/comparison`,
    // Anything but the lowest compliant quote needs a written reason.
    AWARD: (id: string) => `${API_BASE_URL}/rfqs/${id}/award`,
    CONVERT: (id: string) => `${API_BASE_URL}/rfqs/${id}/convert`,
    CANCEL: (id: string) => `${API_BASE_URL}/rfqs/${id}/cancel`,
  },
  PURCHASE_ORDERS: {
    LIST: `${API_BASE_URL}/purchase-orders`,
    CREATE: `${API_BASE_URL}/purchase-orders`,
    DETAIL: (id: string) => `${API_BASE_URL}/purchase-orders/${id}`,
    UPDATE: (id: string) => `${API_BASE_URL}/purchase-orders/${id}`,
    SUBMIT: (id: string) => `${API_BASE_URL}/purchase-orders/${id}/submit`,
    APPROVE: (id: string) => `${API_BASE_URL}/purchase-orders/${id}/approve`,
    REJECT: (id: string) => `${API_BASE_URL}/purchase-orders/${id}/reject`,
    ISSUE: (id: string) => `${API_BASE_URL}/purchase-orders/${id}/issue`,
    CLOSE: (id: string) => `${API_BASE_URL}/purchase-orders/${id}/close`,
    RECEIPTS: (id: string) => `${API_BASE_URL}/purchase-orders/${id}/receipts`,
  },
  PAYMENTS: {
    LIST: `${API_BASE_URL}/payments`,
    PREPARE: `${API_BASE_URL}/payments`,
    PAYABLE: `${API_BASE_URL}/payments/payable`,
    DETAIL: (id: string) => `${API_BASE_URL}/payments/${id}`,
    SUBMIT: (id: string) => `${API_BASE_URL}/payments/${id}/submit`,
    RELEASE: (id: string) => `${API_BASE_URL}/payments/${id}/release`,
    REJECT: (id: string) => `${API_BASE_URL}/payments/${id}/reject`,
    // Only a released run exports; the file is downloaded, never sent.
    BANK_FILE: (id: string) => `${API_BASE_URL}/payments/${id}/bank-file`,
  },
  MATCH: {
    // Advisory: explains what approval would say, before anyone tries.
    INVOICE: (id: string) => `${API_BASE_URL}/invoices/${id}/match`,
  },
  BANK_STATEMENTS: {
    LIST: `${API_BASE_URL}/bank-statements`,
    // Multipart; the format is detected from the content, not the filename.
    UPLOAD: `${API_BASE_URL}/bank-statements/upload`,
    DETAIL: (id: string) => `${API_BASE_URL}/bank-statements/${id}`,
    // Both directions: released runs the bank never confirmed, and debits no
    // instruction explains.
    RECONCILIATION: `${API_BASE_URL}/bank-statements/reconciliation`,
    // Suggestions only. Never render these as a completed match.
    SUGGESTIONS: (lineId: string) =>
      `${API_BASE_URL}/bank-statements/lines/${lineId}/suggestions`,
    MATCH: (lineId: string) => `${API_BASE_URL}/bank-statements/lines/${lineId}/match`,
    UNMATCH: (lineId: string) => `${API_BASE_URL}/bank-statements/lines/${lineId}/unmatch`,
  },
  DELEGATIONS: {
    LIST: `${API_BASE_URL}/delegations`,
    CREATE: `${API_BASE_URL}/delegations`,
    REVOKE: (id: string) => `${API_BASE_URL}/delegations/${id}/revoke`,
  },
};

// API fetch wrapper with token expiration handling
export async function apiFetch(
  url: string,
  options: RequestInit = {},
  token?: string
): Promise<Response> {
  // Record rather than HeadersInit: HeadersInit is a union that also covers
  // Headers and string[][], neither of which supports index assignment.
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Check for 401 Unauthorized (token expired or invalid)
  if (response.status === 401) {
    // Clear localStorage and redirect to login. Must match the key the auth
    // context stores under (sarmaya_user_data); otherwise the stale session is
    // never cleared and the app can loop on the expired token.
    localStorage.removeItem('sarmaya_user_data');
    window.location.href = '/login';
    throw new Error('Session expired. Please login again.');
  }

  return response;
}

// Special fetch for file uploads (no Content-Type header)
export async function apiUpload(
  url: string,
  formData: FormData,
  token?: string,
  onProgress?: (progress: number) => void
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status === 401) {
        localStorage.removeItem('sarmaya_user_data');
        window.location.href = '/login';
        reject(new Error('Session expired. Please login again.'));
        return;
      }

      const response = new Response(xhr.response, {
        status: xhr.status,
        statusText: xhr.statusText,
        headers: new Headers({
          'Content-Type': xhr.getResponseHeader('Content-Type') || 'application/json',
        }),
      });
      resolve(response);
    };

    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });
}
