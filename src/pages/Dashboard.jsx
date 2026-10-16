import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, TrendingUp } from 'lucide-react';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../auth/useAuth';
import { dashboardService } from '../services/dashboardService';
import { resourceService } from '../services/resourceService';
import { mockExams } from '../data/mockExams';
import './Dashboard.css';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [recentResources, setRecentResources] = useState([]);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      // Load dashboard stats from API
      const data = await dashboardService.getDashboard();
      setDashboardData(data);

      // Load recent resources
      try {
        const resources = await resourceService.getResources();
        setRecentResources(resources.slice(0, 4));
      } catch (error) {
        console.warn('Failed to load resources:', error);
        setRecentResources([]);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      // Show error state instead of fake data
      setDashboardData({
        resources: { uploaded: 0, downloaded: 0, shared: 0 },
        clubs: { owned: 0, joined: 0, total: 0 },
        quizzes: { created: 0, completed: 0, averageScore: 0 },
        recentActivity: []
      });
      setRecentResources([]);
    } finally {
      setLoading(false);
    }
  }

  const stats = dashboardData ? [
    {
      title: 'Resources',
      value: dashboardData.resources.uploaded,
      icon: '📚',
      color: '#a855f7',
      trend: { direction: 'up', value: `${dashboardData.resources.shared} shared` }
    },
    {
      title: 'Quizzes Taken',
      value: dashboardData.quizzes.completed,
      icon: '✏️',
      color: '#3b82f6',
      trend: { direction: 'up', value: `${dashboardData.quizzes.created} created` }
    },
    {
      title: 'Study Groups',
      value: dashboardData.clubs.total,
      icon: '👥',
      color: '#10b981',
      trend: { direction: 'up', value: `${dashboardData.clubs.owned} owned` }
    },
    {
      title: 'Average Score',
      value: `${Math.round(dashboardData.quizzes.averageScore)}%`,
      icon: '📈',
      color: '#f59e0b'
    },
  ] : [];

  const upcomingExams = mockExams.slice(0, 3);

  const subjectProgress = [
    { subject: 'Data Structures', progress: 85, color: '#a855f7' },
    { subject: 'Machine Learning', progress: 72, color: '#3b82f6' },
    { subject: 'Database Management', progress: 80, color: '#10b981' },
    { subject: 'Cloud Computing', progress: 68, color: '#f59e0b' },
  ];

  if (loading) {
    return <LoadingSpinner text="Loading dashboard..." />;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-hero">
        <div>
          <h1>Welcome back, {user.name}! 👋</h1>
          <p>Here's what's happening with your studies today</p>
        </div>
        <div className="quick-actions">
          <button className="quick-action-btn primary" onClick={() => navigate('/upload')}>
            <span>📤</span> Upload Resource
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/exams')}>
            <span>✏️</span> Take Quiz
          </button>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      <div className="dashboard-content">
        <section className="dashboard-section recent-resources-section">
          <div className="section-header">
            <h2>Recent Study Resources</h2>
            <button className="view-all-btn" onClick={() => navigate('/resources')}>
              View All <ArrowRight size={16} />
            </button>
          </div>
          <div className="resources-list">
            {recentResources.length > 0 ? (
              recentResources.map((resource) => (
                <div
                  key={resource.id}
                  className="resource-item"
                  onClick={() => navigate(`/resources/${resource.id}`)}
                >
                  <div className="resource-icon">📄</div>
                  <div className="resource-details">
                    <h4>{resource.title}</h4>
                    <p className="resource-meta">
                      {resource.type} • {resource.subject} • {resource.uploadedBy}
                    </p>
                    <span className="resource-date">{resource.uploadDate}</span>
                  </div>
                  <button className="resource-action">Open</button>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <p>No recent resources found. Upload your first resource to get started!</p>
              </div>
            )}
          </div>
        </section>

        <div className="dashboard-sidebar">
          <section className="dashboard-section upcoming-exams">
            <div className="section-header">
              <h2>Upcoming Exams</h2>
            </div>
            <div className="exams-list">
              {upcomingExams.map((exam) => (
                <div key={exam.id} className="exam-item">
                  <div className="exam-date">
                    <span className="exam-day">{new Date(exam.date).getDate()}</span>
                    <span className="exam-month">
                      {new Date(exam.date).toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                  </div>
                  <div className="exam-details">
                    <h4>{exam.subject}</h4>
                    <p>{exam.time} • {exam.room}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="dashboard-section study-progress">
            <div className="section-header">
              <h2>
                <TrendingUp size={20} /> Study Progress
              </h2>
            </div>
            <div className="progress-list">
              {subjectProgress.map((item, index) => (
                <div key={index} className="progress-item">
                  <div className="progress-info">
                    <span className="progress-subject">{item.subject}</span>
                    <span className="progress-value">{item.progress}%</span>
                  </div>
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${item.progress}%`,
                        backgroundColor: item.color
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <section className="dashboard-section recent-activity-section">
        <div className="section-header">
          <h2>Recent Activity</h2>
        </div>
        <div className="activity-list">
          {dashboardData?.recentActivity?.length > 0 ? (
            dashboardData.recentActivity.map((activity, index) => (
              <div key={index} className="activity-item">
                <div className="activity-icon">
                  {activity.type === 'DOWNLOAD' ? '📥' : '✏️'}
                </div>
                <div className="activity-content">
                  <p>
                    {activity.type === 'DOWNLOAD'
                      ? `Downloaded a resource`
                      : `Completed quiz with ${activity.score}% score`
                    }
                  </p>
                  <span className="activity-time">
                    {new Date(activity.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <p>No recent activity yet. Start exploring resources and taking quizzes!</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
