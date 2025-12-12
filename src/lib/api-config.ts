export const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/auth/login`,
    REGISTER: `${API_BASE_URL}/auth/register`,
  },
  INVOICES: {
    LIST: `${API_BASE_URL}/invoices`,
    DETAIL: (id: string) => `${API_BASE_URL}/invoices/${id}`,
  },
  INVESTOR_PITCH_COACH: {
    LIST: `${API_BASE_URL}/investor-pitch-coach`,
    ANALYSIS: `${API_BASE_URL}/investor-pitch-coach/analysis`,
  },
};
