const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
  summary?: Record<string, number>;
}

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  } catch (err) {
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      throw new Error('Backend unavailable — please ensure the backend is running on ' + API_URL);
    }
    throw err;
  }

  const json = await res.json();

  if (!res.ok || json.success === false) {
    throw new Error(json.message || `API error: ${res.status}`);
  }

  return json as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}
