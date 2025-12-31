// frontend/user/src/lib/api.ts

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

type FetchOptions = RequestInit & {
  // Add any custom options here if needed
};

/**
 * A wrapper around native fetch that handles:
 * 1. Base URL
 * 2. Content-Type headers
 * 3. Credentials (Cookies)
 * 4. Error parsing
 */
export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { headers, ...rest } = options;

  // 1. Prepare URL
  // Handles leading slash: '/auth/login' -> 'http://localhost:3000/api/auth/login'
  const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  console.log(url)

  // 2. Prepare Headers
  const config: RequestInit = {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    // CRITICAL: This sends the HttpOnly cookies (JWT) to the backend
    credentials: 'include', 
  };

  // 3. Execute Request
  const response = await fetch(url, config);

  console.log(response)

  // 4. Handle Errors
  if (!response.ok) {
    // Try to parse the error message from the backend JSON
    let errorMessage = 'An error occurred';
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || response.statusText;
    } catch {
      errorMessage = response.statusText;
    }

    // Throw specific error so React Query / SWR can catch it
    throw new Error(errorMessage);
  }

  // 5. Return Typed Data
  // If response has no content (e.g. 204), return null
  if (response.status === 204) return null as T;
  
  return response.json();
}