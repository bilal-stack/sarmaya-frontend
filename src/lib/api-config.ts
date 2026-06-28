export const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/auth/login`,
    REGISTER: `${API_BASE_URL}/auth/register`,
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
};

// API fetch wrapper with token expiration handling
export async function apiFetch(
  url: string,
  options: RequestInit = {},
  token?: string
): Promise<Response> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
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
