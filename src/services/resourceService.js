import { fetchAuthSession } from 'aws-amplify/auth';

const API_URL =
  'https://vaja7mf7u4.execute-api.ap-south-1.amazonaws.com';

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

async function readError(response, fallback) {
  let message = `${fallback} (HTTP ${response.status})`;

  try {
    const body = await response.json();
    message = body.error || body.message || message;
  } catch {
    // Response body was not JSON; keep the fallback message.
  }

  return message;
}

export const resourceService = {

  // =========================================================
  // RESOURCES
  // =========================================================

  async getResources(filters = {}) {
    try {
      // The library is personal: the backend scopes results to the verified
      // Cognito identity (owned resources + resources the user saved). We never
      // send a user id from the client - only this intent flag.
      const query = new URLSearchParams({ mine: 'true' });

      const data = await apiRequest(`/resources?${query.toString()}`, {
        method: 'GET',
      });

      let resources = (Array.isArray(data) ? data : []).map(item => ({
        id: item.resourceId || item.PK?.replace('RESOURCE#', ''),
        title: item.title || 'Untitled Resource',
        subject: item.subject || 'General',
        description: item.description || '',
        type: item.type || 'Notes',
        semester: item.semester || '',
        uploadedBy: item.uploadedBy || 'Unknown',
        ownerId: item.ownerId || '',
        uploadDate: item.uploadDate || '',
        downloads: item.downloads || 0,
        likes: item.likes || 0,
        fileSize: item.fileSize || 'N/A',
        s3Key: item.s3Key || '',
        visibility: item.visibility || 'PUBLIC',
        sharedClubs: Array.isArray(item.sharedClubs) ? item.sharedClubs : [],
        processingStatus: item.processingStatus || '',
        isOwner: Boolean(item.isOwner),
        saved: Boolean(item.saved),
      }));

      if (filters.subject && filters.subject !== 'All Subjects') {
        resources = resources.filter(
          r => r.subject === filters.subject
        );
      }

      if (filters.type && filters.type !== 'All Types') {
        resources = resources.filter(
          r => r.type === filters.type
        );
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();

        resources = resources.filter(r =>
          r.title.toLowerCase().includes(searchLower) ||
          r.description.toLowerCase().includes(searchLower) ||
          r.subject.toLowerCase().includes(searchLower)
        );
      }

      return resources;
    } catch (error) {
      console.error('Error loading resources:', error);
      throw error;
    }
  },

  async getResourceById(id) {
    const resources = await this.getResources();

    return resources.find(resource => resource.id === id) || null;
  },

  async searchResources(query) {
    return this.getResources({
      search: query,
    });
  },

  async saveResource(resourceId, options = {}) {
    if (!resourceId) {
      throw new Error('A resource id is required to save a resource');
    }

    return apiRequest('/resources', {
      method: 'POST',
      body: JSON.stringify({
        saveResourceId: resourceId,
        ...(options.clubId ? { clubId: options.clubId } : {}),
      }),
    });
  },

  async uploadResource(resourceData) {
    const token = await getToken();

    const file = resourceData.file;
    const contentType = file.type || 'application/octet-stream';

    // 1. Get S3 upload URL
    const response = await fetch(`${API_URL}/upload-url`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: file.name,
        fileType: contentType,
      }),
    });

    if (!response.ok) {
      throw new Error(await readError(response, 'Failed to get upload URL'));
    }

    const { uploadUrl, fileKey } = await response.json();

    // 2. Upload file to S3. The presigned URL signs the content-type header,
    // so the PUT request must send the exact same Content-Type.
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error(await readError(uploadResponse, 'Failed to upload file to storage'));
    }

    // 3. Save metadata
    const metadataResponse = await fetch(`${API_URL}/resources`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: resourceData.title,
        subject: resourceData.subject,
        type: resourceData.type,
        semester: resourceData.semester,
        description: resourceData.description,
        s3Key: fileKey,
      }),
    });

    if (!metadataResponse.ok) {
      throw new Error(await readError(metadataResponse, 'Failed to save resource metadata'));
    }

    return {
      success: true,
      message: 'File and resource metadata uploaded successfully',
      fileKey,
    };
  },

  async deleteResource(resourceId) {
    return apiRequest(`/resources/${encodeURIComponent(resourceId)}`, {
      method: 'DELETE',
    });
  },

  async downloadResource(s3Key) {
    const data = await apiRequest('/download-url', {
      method: 'POST',
      body: JSON.stringify({
        s3Key,
      }),
    });

    if (!data.downloadUrl) {
      throw new Error('Download URL was not returned');
    }

    window.open(data.downloadUrl, '_blank');
  },

  async getRelatedResources(resourceId, subject) {
    const resources = await this.getResources({
      subject,
    });

    return resources
      .filter(r => r.id !== resourceId)
      .slice(0, 3);
  },

  // =========================================================
  // STUDY CLUBS
  // =========================================================

  async createClub(name, subject, description = '') {
    return apiRequest('/clubs', {
      method: 'POST',
      body: JSON.stringify({
        name,
        subject,
        description,
      }),
    });
  },

  async joinClub(clubId) {
    return apiRequest('/clubs/join', {
      method: 'POST',
      body: JSON.stringify({
        clubId,
      }),
    });
  },

  async getClub(clubId) {
    return apiRequest(`/clubs/${clubId}`, {
      method: 'GET',
    });
  },

  // =========================================================
  // DISCUSSION
  // =========================================================

  async getMessages(clubId) {
    return apiRequest(`/clubs/${clubId}/messages`, {
      method: 'GET',
    });
  },

  async postMessage(clubId, message) {
    return apiRequest(`/clubs/${clubId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        message,
      }),
    });
  },

  // =========================================================
  // AI STUDY ASSISTANT
  // =========================================================

  async askAI(question, subject = '') {
    return apiRequest('/ai/ask', {
      method: 'POST',
      body: JSON.stringify({
        question,
        subject,
      }),
    });
  },

  // =========================================================
  // AI QUIZ GENERATOR
  // =========================================================

  async generateQuiz(topic, count = 5) {
    return apiRequest('/ai/quiz', {
      method: 'POST',
      body: JSON.stringify({
        topic,
        count,
      }),
    });
  },
};