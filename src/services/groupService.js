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
      console.error(`API Error [${endpoint}]:`, { status: response.status, error });
    } catch {
      console.error(`API Error [${endpoint}]:`, { status: response.status, text: await response.text().catch(() => 'no body') });
    }
    throw new Error(message);
  }

  return response.json();
}

export const groupService = {

  async getGroups() {
    try {
      const data = await apiRequest('/clubs', { method: 'GET' });
      return (data.clubs || []).map(club => ({
        id: club.clubId,
        name: club.name,
        subject: club.subject,
        description: club.description || '',
        members: club.memberCount || 0,
        createdDate: club.createdAt ? new Date(club.createdAt).toLocaleDateString() : '',
        isActive: true,
        isJoined: club.isMember || false,
        avatar: getSubjectEmoji(club.subject),
      }));
    } catch (error) {
      console.error('Failed to load clubs:', error);
      return [];
    }
  },

  async getMyGroups() {
    try {
      const data = await apiRequest('/clubs?joined=true', { method: 'GET' });
      return (data.clubs || []).map(club => ({
        id: club.clubId,
        name: club.name,
        subject: club.subject,
        description: club.description || '',
        members: club.memberCount || 0,
        createdDate: club.createdAt ? new Date(club.createdAt).toLocaleDateString() : '',
        isActive: true,
        isJoined: true,
        avatar: getSubjectEmoji(club.subject),
      }));
    } catch (error) {
      console.error('Failed to load my clubs:', error);
      return [];
    }
  },

  async getGroupById(clubId) {
    try {
      const data = await apiRequest(`/clubs/${clubId}`, { method: 'GET' });
      const club = data.club;

      return {
        id: club.clubId,
        name: club.name,
        subject: club.subject,
        description: club.description || '',
        members: club.memberCount || 0,
        createdDate: club.createdAt ? new Date(club.createdAt).toLocaleDateString() : '',
        isActive: true,
        isJoined: data.isMember || false,
        userRole: data.userRole || null,
        avatar: getSubjectEmoji(club.subject),
      };
    } catch (error) {
      console.error('Error loading club:', error);
      throw error;
    }
  },

  async createGroup(name, subject, description = '') {
    return apiRequest('/clubs', {
      method: 'POST',
      body: JSON.stringify({ name, subject, description }),
    });
  },

  async joinGroup(clubId) {
    return apiRequest('/clubs/join', {
      method: 'POST',
      body: JSON.stringify({ clubId }),
    });
  },

  async leaveGroup(clubId) {
    return apiRequest('/clubs/leave', {
      method: 'POST',
      body: JSON.stringify({ clubId }),
    });
  },

  async deleteGroup(clubId) {
    return apiRequest(`/clubs/${clubId}`, {
      method: 'DELETE',
    });
  },

  async getGroupPosts(clubId) {
    try {
      const data = await apiRequest(`/clubs/${clubId}/messages`, { method: 'GET' });
      return (data.messages || []).map(message => ({
        id: message.messageId,
        author: message.userName || 'Club Member',
        avatar: '👨‍🎓',
        content: message.message,
        time: formatTime(message.createdAt),
        likes: 0,
        isLiked: false,
        comments: [],
      }));
    } catch (error) {
      console.error('Error loading messages:', error);
      return [];
    }
  },

  async addPost(clubId, content) {
    return apiRequest(`/clubs/${clubId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message: content }),
    });
  },

  async likePost() {
    return { success: true };
  },

  async addComment() {
    return {
      success: true,
      message: 'Comments will be added later',
    };
  },

  async getGroupMembers(clubId) {
    try {
      const data = await apiRequest(`/clubs/${clubId}`, { method: 'GET' });
      return (data.members || []).map(member => ({
        id: member.userId,
        name: member.userName || 'Club Member',
        avatar: '👨‍🎓',
        role: member.role || 'MEMBER',
        joinedDate: member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : '',
      }));
    } catch (error) {
      console.error('Error loading members:', error);
      return [];
    }
  },

  async getGroupResources(clubId) {
    try {
      const data = await apiRequest(`/clubs/${clubId}/resources`, { method: 'GET' });
      return (data.resources || []).map(res => ({
        id: res.resourceId,
        title: res.title || 'Untitled',
        type: res.type || 'Document',
        uploadedBy: res.uploadedBy || 'Unknown',
        uploadDate: res.uploadDate || '',
        s3Key: res.s3Key,
        subject: res.subject || '',
        ownerId: res.ownerId || '',
        isOwner: Boolean(res.isOwner),
        saved: Boolean(res.saved),
      }));
    } catch (error) {
      console.error('Error loading club resources:', error);
      return [];
    }
  },

  async shareResourceWithGroup(clubId, resourceId) {
    return apiRequest(`/clubs/${clubId}/resources`, {
      method: 'POST',
      body: JSON.stringify({ resourceId }),
    });
  },

  async searchUsers(query) {
    const data = await apiRequest(`/users/search?q=${encodeURIComponent(query)}`, { method: 'GET' });
    return data.users || [];
  },

  async inviteMember(clubId, userId, userName) {
    return apiRequest(`/clubs/${clubId}/invites`, {
      method: 'POST',
      body: JSON.stringify({ userId, userName }),
    });
  },

  async getGroupInvites(clubId) {
    try {
      const data = await apiRequest(`/clubs/${clubId}/invites`, { method: 'GET' });
      return (data.invites || []).map(inv => ({
        userId: inv.userId,
        name: inv.name || 'Invited User',
        invitedByName: inv.invitedByName || '',
        status: inv.status || 'PENDING',
        createdAt: inv.createdAt || '',
      }));
    } catch (error) {
      console.error('Error loading club invitations:', error);
      return [];
    }
  },

  async getMyInvites() {
    try {
      const data = await apiRequest('/club-invites', { method: 'GET' });
      return (data.invites || []).map(inv => ({
        clubId: inv.clubId,
        clubName: inv.clubName || 'Study Club',
        clubSubject: inv.clubSubject || '',
        invitedByName: inv.invitedByName || '',
        status: inv.status || 'PENDING',
        createdAt: inv.createdAt || '',
      }));
    } catch (error) {
      console.error('Error loading invitations:', error);
      return [];
    }
  },

  async acceptInvite(clubId) {
    return apiRequest('/club-invites/accept', {
      method: 'POST',
      body: JSON.stringify({ clubId }),
    });
  },

  async declineInvite(clubId) {
    return apiRequest('/club-invites/decline', {
      method: 'POST',
      body: JSON.stringify({ clubId }),
    });
  },

  async searchGroups(query) {
    const allGroups = await this.getGroups();
    const lowerQuery = query.toLowerCase();
    return allGroups.filter(g =>
      g.name.toLowerCase().includes(lowerQuery) ||
      g.description.toLowerCase().includes(lowerQuery) ||
      g.subject.toLowerCase().includes(lowerQuery)
    );
  },
};

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function getSubjectEmoji(subject) {
  const emojiMap = {
    'Computer Science': '💻',
    'Data Science': '📊',
    'Machine Learning': '🤖',
    'Web Development': '🌐',
    'Cloud Computing': '☁️',
    'Database': '🗄️',
    'AI': '🧠',
    'Mathematics': '📐',
    'Physics': '⚛️',
    'Chemistry': '🧪',
  };

  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (subject.includes(key)) return emoji;
  }

  return '📚';
}