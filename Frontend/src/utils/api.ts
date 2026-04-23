const isProd = import.meta.env.PROD;
export const API_BASE_URL = isProd 
  ? (import.meta.env.VITE_BACKEND_URL || window.location.origin).replace(/\/$/, '')
  : 'http://localhost:10000';

export const apiFetch = async (endpoint: string, options: RequestInit = {}, userId?: string) => {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(userId ? { 'x-user-id': userId } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }

  return response.json();
};
