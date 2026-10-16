import { fetchAuthSession } from 'aws-amplify/auth';

const API_URL = import.meta.env.VITE_API_URL || 'https://vaja7mf7u4.execute-api.ap-south-1.amazonaws.com';

async function getToken() {
  const { tokens } = await fetchAuthSession();
  if (!tokens?.idToken) {
    throw new Error('User is not authenticated');
  }
  return tokens.idToken.toString();
}

async function apiRequest(endpoint, options = {}) {
  const token = await getToken();

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;
    try {
      const error = await response.json();
      message = error.error || error.message || message;
    } catch (_) {}
    throw new Error(message);
  }

  return response.json();
}

export const dashboardService = {
  // Get dashboard stats for authenticated user
  async getDashboard() {
    return apiRequest('/dashboard', { method: 'GET' });
  },

  // Get user profile
  async getProfile() {
    return apiRequest('/profile', { method: 'GET' });
  },

  // Update user profile
  async updateProfile(profileData) {
    return apiRequest('/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },
};
