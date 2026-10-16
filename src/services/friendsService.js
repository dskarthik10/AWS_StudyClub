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
    } catch {
      // Response body was not JSON; keep the default message.
    }
    throw new Error(message);
  }

  return response.json();
}

export const friendsService = {
  // Search users by name or email
  async searchUsers(query) {
    return apiRequest(`/users/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
    });
  },

  // Send friend request
  async sendFriendRequest(userId) {
    return apiRequest('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  // Accept friend request
  async acceptFriendRequest(userId) {
    return apiRequest('/friends/accept', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  // Reject friend request
  async rejectFriendRequest(userId) {
    return apiRequest('/friends/reject', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  // Remove friend
  async removeFriend(friendId) {
    return apiRequest(`/friends/${friendId}`, {
      method: 'DELETE',
    });
  },

  // Get list of confirmed friends
  async getFriends() {
    return apiRequest('/friends', { method: 'GET' });
  },

  // Get incoming friend requests
  async getFriendRequests() {
    return apiRequest('/friends/requests', { method: 'GET' });
  },

  // Get outgoing pending friend requests
  async getOutgoingRequests() {
    return apiRequest('/friends/requests?type=outgoing', { method: 'GET' });
  },
};
