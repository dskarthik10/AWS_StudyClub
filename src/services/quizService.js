import { fetchAuthSession } from 'aws-amplify/auth';
import { mockQuizzes } from '../data/mockQuizzes';

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

export const quizService = {
  // Get all quizzes for authenticated user
  async getQuizzes(filters = {}) {
    try {
      const data = await apiRequest('/quiz', { method: 'GET' });
      let quizzes = (data.quizzes || []).map(q => ({
        id: q.quizId,
        title: q.title,
        questionCount: q.questionCount,
        createdAt: q.createdAt,
        subject: q.subject || q.resources?.[0]?.subject || 'General',
        difficulty: q.difficulty || 'Medium',
        description: q.description || `Quiz with ${q.questionCount} questions`,
        estimatedTime: `${q.questionCount} min`,
        totalMarks: q.questionCount,
      }));

      // Apply client-side filters
      if (filters.subject && filters.subject !== 'All Subjects') {
        quizzes = quizzes.filter(q => q.subject === filters.subject);
      }

      if (filters.difficulty && filters.difficulty !== 'All Difficulties') {
        quizzes = quizzes.filter(q => q.difficulty === filters.difficulty);
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        quizzes = quizzes.filter(q =>
          q.title.toLowerCase().includes(searchLower) ||
          q.subject.toLowerCase().includes(searchLower)
        );
      }

      return quizzes;
    } catch (error) {
      console.warn('API quiz fetch failed, using mock data:', error);
      return mockQuizzes;
    }
  },

  // Get a single quiz by ID
  async getQuizById(id) {
    try {
      const data = await apiRequest(`/quiz/${id}`, { method: 'GET' });

      return {
        id: data.quizId,
        title: data.title,
        questionCount: data.questionCount,
        subject: data.subject || data.resources?.[0]?.subject || 'General',
        difficulty: data.difficulty || 'Medium',
        description: data.description || `Quiz with ${data.questionCount} questions`,
        questions: (data.questions || []).map(q => ({
          id: q.questionId,
          question: q.question,
          options: q.options,
          // Never include correctAnswer before submission, even for owners
        })),
        isOwner: data.isOwner,
      };
    } catch (error) {
      console.warn('API quiz fetch failed, using mock data:', error);
      const quiz = mockQuizzes.find(q => q.id === id);
      if (!quiz) throw new Error('Quiz not found');
      return quiz;
    }
  },

  // Submit quiz answers and get server-side scoring
  async submitQuiz(quizId, answers) {
    try {
      const data = await apiRequest(`/quiz/${quizId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });

      return {
        quizId: data.quizId,
        quizTitle: data.quizTitle || 'Quiz',
        totalQuestions: data.results?.length || 0,
        correctAnswers: data.results?.filter(r => r.isCorrect).length || 0,
        incorrectAnswers: data.results?.filter(r => !r.isCorrect).length || 0,
        score: data.scorePercent || 0,
        percentage: data.scorePercent || 0,
        results: (data.results || []).map(r => ({
          questionId: r.questionId,
          question: r.question,
          userAnswer: r.yourAnswer,
          correctAnswer: r.correctAnswer,
          isCorrect: r.isCorrect,
          options: r.options || [],
          explanation: r.explanation,
        })),
      };
    } catch (error) {
      console.error('Quiz submission failed:', error);
      throw error;
    }
  },

  // Generate quiz from resource document (Bedrock-dependent)
  async generateQuizFromResource(resourceId, count = 5, title = '') {
    try {
      const data = await apiRequest('/quiz/generate', {
        method: 'POST',
        body: JSON.stringify({
          resourceIds: [resourceId],
          count,
          title,
          save: true,
        }),
      });

      return {
        quizId: data.quizId,
        title: data.title,
        questionCount: data.questionCount,
        questions: data.questions,
      };
    } catch (error) {
      // Bedrock access is blocked - return helpful error
      if (error.message.includes('Operation not allowed') || error.message.includes('502')) {
        throw new Error('AI quiz generation is currently unavailable. Please use manually created quizzes or contact support to enable Bedrock access.');
      }
      throw error;
    }
  },

  // Get quiz attempt results
  async getQuizResults(quizId) {
    try {
      return apiRequest(`/quiz/${quizId}/result`, { method: 'GET' });
    } catch (error) {
      console.error('Failed to fetch quiz results:', error);
      return { quizId, attempts: [], count: 0 };
    }
  },

  // Search quizzes (client-side for now)
  async searchQuizzes(query) {
    const allQuizzes = await this.getQuizzes();
    const lowerQuery = query.toLowerCase();
    return allQuizzes.filter(q =>
      q.title.toLowerCase().includes(lowerQuery) ||
      q.subject.toLowerCase().includes(lowerQuery)
    );
  },
};
