export const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

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
  },
  VENDORS: {
    LIST: `${API_BASE_URL}/vendors`,
    REVIEW_QUEUE: `${API_BASE_URL}/vendors/review-queue`,
    SET_STATUS: (id: string) => `${API_BASE_URL}/vendors/${id}/status`,
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
  USERS: {
    // Directory for the delegate picker; requires users.view.
    LIST: `${API_BASE_URL}/users`,
    // Role changes require users.manage and are never self-service.
    SET_ROLE: (id: string) => `${API_BASE_URL}/users/${id}/role`,
  },
  DASHBOARD: {
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
