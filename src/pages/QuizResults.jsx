import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { RotateCcw, Home, Trophy } from 'lucide-react';
import './QuizResults.css';

export default function QuizResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const results = location.state?.results;

  if (!results) {
    navigate('/exams');
    return null;
  }

  const { quizTitle, totalQuestions, correctAnswers, incorrectAnswers, percentage, results: questionResults } = results;

  const getPerformanceMessage = (score) => {
    if (score >= 90) return { message: 'Excellent Work! 🎉', icon: '🏆', detail: 'Outstanding performance!' };
    if (score >= 75) return { message: 'Great Job! 👏', icon: '🌟', detail: 'Very good understanding!' };
    if (score >= 60) return { message: 'Good Effort! 👍', icon: '✨', detail: 'Keep practicing!' };
    if (score >= 40) return { message: 'Keep Trying! 💪', icon: '📚', detail: 'Review the topics and try again.' };
    return { message: 'Need More Practice 📖', icon: '🔄', detail: 'Don\'t give up, keep learning!' };
  };

  const performance = getPerformanceMessage(percentage);

  return (
    <div className="quiz-results">
      <div className="results-container">
        <div className="results-header">
          <div className="results-icon">{performance.icon}</div>
          <h1>{performance.message}</h1>
          <p className="results-subtitle">{quizTitle}</p>
        </div>

        <div className="score-card">
          <div className="score-display">
            <div className="score-circle" style={{ '--score': percentage, background: 'var(--bg-secondary)' }}>
              <span style={{ color: percentage >= 60 ? 'var(--success)' : percentage >= 40 ? 'var(--warning)' : 'var(--danger)' }}>
                {percentage}%
              </span>
            </div>
            <h2 className="performance-message">{performance.detail}</h2>
            <p className="performance-detail">
              You got {correctAnswers} out of {totalQuestions} questions correct
            </p>
          </div>

          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-label">Total Questions</div>
              <div className="stat-value">{totalQuestions}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Correct</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>{correctAnswers}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Incorrect</div>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{incorrectAnswers}</div>
            </div>
          </div>
        </div>

        <div className="results-actions">
          <button className="action-btn primary" onClick={() => navigate('/exams')}>
            <Trophy size={18} /> Take Another Quiz
          </button>
          <button className="action-btn secondary" onClick={() => navigate(`/quiz/${id}`)}>
            <RotateCcw size={18} /> Retry Quiz
          </button>
          <button className="action-btn secondary" onClick={() => navigate('/dashboard')}>
            <Home size={18} /> Dashboard
          </button>
        </div>

        <div className="review-section">
          <h2>Question Review</h2>
          {questionResults.map((result, index) => (
            <div key={index} className="review-question">
              <div className="review-header">
                <span className="question-label">Question {index + 1}</span>
                <span className={`result-badge ${result.isCorrect ? 'correct' : 'incorrect'}`}>
                  {result.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                </span>
              </div>
              <p className="review-question-text">{result.question}</p>
              <div className="review-options">
                {result.options.map((option, optIndex) => {
                  const isCorrect = optIndex === result.correctAnswer;
                  const isUserAnswer = optIndex === result.userAnswer;
                  const className = isCorrect
                    ? 'review-option correct'
                    : isUserAnswer
                    ? 'review-option user-incorrect'
                    : 'review-option';

                  return (
                    <div key={optIndex} className={className}>
                      <strong>{String.fromCharCode(65 + optIndex)}.</strong> {option}
                      {isCorrect && ' ✓ (Correct Answer)'}
                      {isUserAnswer && !isCorrect && ' ✗ (Your Answer)'}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
