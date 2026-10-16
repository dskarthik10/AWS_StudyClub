import './Dashboard.css';

function Dashboard() {
  // Mock data
  const stats = [
    { id: 1, title: 'Resources', value: 42, icon: '📚', color: '#aa3bff' },
    { id: 2, title: 'Quizzes Taken', value: 18, icon: '✏️', color: '#3b82f6' },
    { id: 3, title: 'Study Groups', value: 5, icon: '👥', color: '#10b981' },
    { id: 4, title: 'Progress', value: '78%', icon: '📈', color: '#f59e0b' },
  ];

  const recentResources = [
    {
      id: 1,
      title: 'Data Structures & Algorithms Notes',
      type: 'PDF',
      uploadedBy: 'Sarah Chen',
      date: '2026-09-10',
    },
    {
      id: 2,
      title: 'Machine Learning Study Guide',
      type: 'Document',
      uploadedBy: 'Michael Park',
      date: '2026-09-09',
    },
    {
      id: 3,
      title: 'Database Systems Cheat Sheet',
      type: 'PDF',
      uploadedBy: 'Emily Rodriguez',
      date: '2026-09-08',
    },
    {
      id: 4,
      title: 'Operating Systems Practice Questions',
      type: 'Quiz',
      uploadedBy: 'James Wilson',
      date: '2026-09-07',
    },
  ];

  const upcomingExams = [
    {
      id: 1,
      subject: 'Data Structures',
      date: '2026-09-18',
      time: '10:00 AM',
      room: 'Hall A',
    },
    {
      id: 2,
      subject: 'Machine Learning',
      date: '2026-09-22',
      time: '2:00 PM',
      room: 'Lab 3',
    },
    {
      id: 3,
      subject: 'Database Management',
      date: '2026-09-25',
      time: '9:00 AM',
      room: 'Hall B',
    },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome back, Student! 👋</h1>
        <p>Here's what's happening with your studies today</p>
      </div>

      <div className="stats-grid">
        {stats.map((stat) => (
          <div key={stat.id} className="stat-card" style={{ '--card-color': stat.color }}>
            <div className="stat-icon">{stat.icon}</div>
            <div className="stat-content">
              <h3>{stat.title}</h3>
              <p className="stat-value">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-content">
        <section className="recent-resources">
          <div className="section-header">
            <h2>Recent Study Resources</h2>
            <button className="view-all-btn">View All →</button>
          </div>
          <div className="resources-list">
            {recentResources.map((resource) => (
              <div key={resource.id} className="resource-item">
                <div className="resource-icon">📄</div>
                <div className="resource-details">
                  <h4>{resource.title}</h4>
                  <p className="resource-meta">
                    {resource.type} • Uploaded by {resource.uploadedBy} • {resource.date}
                  </p>
                </div>
                <button className="resource-action">Open</button>
              </div>
            ))}
          </div>
        </section>

        <section className="upcoming-exams">
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
                  <p className="exam-info">
                    {exam.time} • {exam.room}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
