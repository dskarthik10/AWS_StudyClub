import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, CheckCircle } from 'lucide-react';
import { quizService } from '../services/quizService';
import LoadingSpinner from '../components/LoadingSpinner';
import './Quiz.css';

export default function Quiz() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadQuiz();
  }, [id]);

  useEffect(() => {
    if (quiz) {
      const timer = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [quiz]);

  const loadQuiz = async () => {
    setLoading(true);
    try {
      const data = await quizService.getQuizById(id);
      setQuiz(data);
    } catch (error) {
      console.error('Error loading quiz:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (questionIndex, answerIndex) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: answerIndex,
    }));
  };

  const handleNext = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < quiz.questions.length) {
      if (!window.confirm('You have not answered all questions. Do you want to submit anyway?')) {
        return;
      }
    }

    setSubmitting(true);
    try {
      // Convert answer indices to actual answer text
      const answerArray = quiz.questions.map((question, index) => {
        const answerIndex = answers[index];
        return answerIndex !== undefined ? question.options[answerIndex] : '';
      });
      const results = await quizService.submitQuiz(id, answerArray);
      navigate(`/quiz/${id}/results`, { state: { results } });
    } catch (error) {
      console.error('Error submitting quiz:', error);
      alert('Failed to submit quiz. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <LoadingSpinner text="Loading quiz..." />;
  }

  if (!quiz) {
    return (
      <div className="quiz">
        <div className="error-state">
          <h2>Quiz not found</h2>
          <button onClick={() => navigate('/exams')}>Back to Exam Prep</button>
        </div>
      </div>
    );
  }

  const question = quiz.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;

  return (
    <div className="quiz">
      <div className="quiz-header">
        <button className="back-btn" onClick={() => navigate('/exams')}>
          <ArrowLeft size={20} /> Exit Quiz
        </button>

        <div className="quiz-info">
          <h1>{quiz.title}</h1>
          <div className="quiz-meta">
            <span>{quiz.subject}</span>
            <span>•</span>
            <span><Clock size={16} /> {formatTime(timeElapsed)}</span>
          </div>
        </div>
      </div>

      <div className="quiz-progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="quiz-container">
        <div className="question-card">
          <div className="question-header">
            <span className="question-number">
              Question {currentQuestion + 1} of {quiz.questions.length}
            </span>
            {answers[currentQuestion] !== undefined && (
              <CheckCircle size={20} color="#10b981" />
            )}
          </div>

          <h2 className="question-text">{question.question}</h2>

          <div className="options-list">
            {question.options.map((option, index) => (
              <button
                key={index}
                className={`option-btn ${answers[currentQuestion] === index ? 'selected' : ''}`}
                onClick={() => handleAnswerSelect(currentQuestion, index)}
              >
                <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                <span className="option-text">{option}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="quiz-navigation">
          <button
            className="nav-btn secondary"
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
          >
            <ArrowLeft size={18} /> Previous
          </button>

          {currentQuestion === quiz.questions.length - 1 ? (
            <button
              className="nav-btn primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
          ) : (
            <button className="nav-btn primary" onClick={handleNext}>
              Next <ArrowRight size={18} />
            </button>
          )}
        </div>

        <div className="question-dots">
          {quiz.questions.map((_, index) => (
            <button
              key={index}
              className={`question-dot ${answers[index] !== undefined ? 'answered' : ''} ${index === currentQuestion ? 'current' : ''}`}
              onClick={() => setCurrentQuestion(index)}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
