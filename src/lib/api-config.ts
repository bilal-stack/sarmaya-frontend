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
  },
  INVESTOR_PITCH_COACH: {
    LIST: `${API_BASE_URL}/investor-pitch-coach`,
    ANALYSIS: `${API_BASE_URL}/investor-pitch-coach/analysis`,
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
    // Clear localStorage and redirect to login
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
        localStorage.removeItem('galsi_user_data');
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
