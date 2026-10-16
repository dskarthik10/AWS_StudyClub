import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Clock, Award } from 'lucide-react';
import { quizService } from '../services/quizService';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import './ExamPrep.css';

export default function ExamPrep() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    subject: 'All Subjects',
    difficulty: 'All Difficulties',
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadQuizzes();
  }, [filters, searchQuery]);

  const loadQuizzes = async () => {
    setLoading(true);
    try {
      const data = await quizService.getQuizzes({
        ...filters,
        search: searchQuery,
      });
      setQuizzes(data);
    } catch (error) {
      console.error('Error loading quizzes:', error);
    } finally {
      setLoading(false);
    }
  };

  const difficultyColors = {
    Easy: '#10b981',
    Medium: '#f59e0b',
    Hard: '#ef4444',
  };

  const subjects = ['All Subjects', 'Data Structures and Algorithms', 'Python Programming', 'Java Programming', 'Database Management Systems', 'Computer Networks', 'Cloud Computing and AWS'];
  const difficulties = ['All Difficulties', 'Easy', 'Medium', 'Hard'];

  return (
    <div className="exam-prep">
      <div className="page-header">
        <div>
          <h1>Exam Preparation</h1>
          <p>Test your knowledge and prepare smarter</p>
        </div>
      </div>

      <div className="search-filter-bar">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search quizzes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <select
          value={filters.subject}
          onChange={(e) => setFilters(prev => ({ ...prev, subject: e.target.value }))}
          className="filter-select"
        >
          {subjects.map(subject => (
            <option key={subject} value={subject}>{subject}</option>
          ))}
        </select>

        <select
          value={filters.difficulty}
          onChange={(e) => setFilters(prev => ({ ...prev, difficulty: e.target.value }))}
          className="filter-select"
        >
          {difficulties.map(diff => (
            <option key={diff} value={diff}>{diff}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading quizzes..." />
      ) : quizzes.length === 0 ? (
        <EmptyState
          icon="✏️"
          title="No quizzes found"
          message="Try adjusting your filters or search query"
        />
      ) : (
        <>
          <div className="quizzes-section">
            <h2>Available Quizzes</h2>
            <div className="quizzes-grid">
              {quizzes.map((quiz) => (
                <div key={quiz.id} className="quiz-card">
                  <div className="quiz-card-header">
                    <span
                      className="difficulty-badge"
                      style={{ background: `${difficultyColors[quiz.difficulty]}20`, color: difficultyColors[quiz.difficulty] }}
                    >
                      {quiz.difficulty}
                    </span>
                    <span className="quiz-subject">{quiz.subject}</span>
                  </div>

                  <h3 className="quiz-title">{quiz.title}</h3>
                  <p className="quiz-description">{quiz.description}</p>

                  <div className="quiz-stats">
                    <div className="quiz-stat">
                      <span className="stat-label">Questions</span>
                      <span className="stat-value">{quiz.questionCount}</span>
                    </div>
                    <div className="quiz-stat">
                      <Clock size={16} />
                      <span>{quiz.estimatedTime}</span>
                    </div>
                    <div className="quiz-stat">
                      <Award size={16} />
                      <span>{quiz.totalMarks} marks</span>
                    </div>
                  </div>

                  <button
                    className="start-quiz-btn"
                    onClick={() => navigate(`/quiz/${quiz.id}`)}
                  >
                    Start Quiz
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
