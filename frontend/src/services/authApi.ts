const API_BASE_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : '/api')

type SessionResponse = {
  authenticated?: boolean
  user?: { email?: string | null } | null
  message?: string
  detail?: string
}

const request = async <T>(path: string, init?: RequestInit) => {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      ...init,
    })

    let body: T | null = null
    try {
      body = (await response.json()) as T
    } catch {
      body = null
    }

    return {
      ok: response.ok,
      status: response.status,
      body,
    }
  } catch {
    return {
      ok: false,
      status: 0,
      body: null as T | null,
    }
  }
}

export const authApi = {
  signInWithGoogle(idToken: string) {
    return request<SessionResponse>('/auth/google-login', {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken }),
    })
  },
  signOut() {
    return request('/auth/logout', { method: 'POST' })
  },
  getSession() {
    return request<SessionResponse>('/auth/session')
  },
  getMe() {
    return request<SessionResponse>('/auth/me')
  },
}
