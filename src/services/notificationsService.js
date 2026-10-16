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

export const notificationsService = {
  // Get all notifications
  async getNotifications(limit = 30, unreadOnly = false) {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (unreadOnly) params.append('unread', 'true');

    return apiRequest(`/notifications?${params}`, { method: 'GET' });
  },

  // Get unread notification count
  async getUnreadCount() {
    return apiRequest('/notifications/unread', { method: 'GET' });
  },

  // Mark single notification as read
  async markAsRead(notificationId) {
    return apiRequest('/notifications/read', {
      method: 'POST',
      body: JSON.stringify({ notificationId }),
    });
  },

  // Mark all notifications as read
  async markAllAsRead() {
    return apiRequest('/notifications/read-all', {
      method: 'POST',
      body: JSON.stringify({ all: true }),
    });
  },
};
