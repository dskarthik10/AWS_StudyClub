import { useState } from 'react';
import { Edit2, Save, X } from 'lucide-react';
import { mockUser, mockRecentActivity } from '../data/mockUsers';
import Toast from '../components/Toast';
import { useAuth } from '../auth/useAuth';
import './Profile.css';

export default function Profile() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState(() => ({ ...mockUser, name: user.name, email: user.email }));
  const [editData, setEditData] = useState(() => ({ ...mockUser, name: user.name, email: user.email }));
  const [toast, setToast] = useState(null);

  const handleEdit = () => {
    setEditData(userData);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditData(userData);
    setIsEditing(false);
  };

  const handleSave = () => {
    setUserData(editData);
    setIsEditing(false);
    setToast({ message: 'Profile updated successfully!', type: 'success' });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="profile">
      <div className="page-header">
        <h1>Profile</h1>
        <button className="edit-profile-btn" onClick={isEditing ? handleSave : handleEdit}>
          {isEditing ? <><Save size={18} /> Save</> : <><Edit2 size={18} /> Edit Profile</>}
        </button>
      </div>

      <div className="profile-content">
        <div className="profile-main">
          <div className="profile-card">
            <div className="profile-header-section">
              <div className="profile-avatar-large">{userData.avatar}</div>
              <div className="profile-info-section">
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      name="name"
                      value={editData.name}
                      onChange={handleChange}
                      className="profile-input"
                    />
                    <input
                      type="email"
                      name="email"
                      value={editData.email}
                      onChange={handleChange}
                      className="profile-input"
                    />
                  </>
                ) : (
                  <>
                    <h2>{userData.name}</h2>
                    <p className="profile-email">{userData.email}</p>
                  </>
                )}
              </div>
              {isEditing && (
                <button className="cancel-btn" onClick={handleCancel}>
                  <X size={18} /> Cancel
                </button>
              )}
            </div>

            <div className="profile-stats-grid">
              <div className="profile-stat">
                <div className="stat-icon">📤</div>
                <div>
                  <div className="stat-value">{userData.stats.resourcesUploaded}</div>
                  <div className="stat-label">Resources Uploaded</div>
                </div>
              </div>
              <div className="profile-stat">
                <div className="stat-icon">✏️</div>
                <div>
                  <div className="stat-value">{userData.stats.quizzesCompleted}</div>
                  <div className="stat-label">Quizzes Completed</div>
                </div>
              </div>
              <div className="profile-stat">
                <div className="stat-icon">👥</div>
                <div>
                  <div className="stat-value">{userData.stats.studyGroups}</div>
                  <div className="stat-label">Study Groups</div>
                </div>
              </div>
              <div className="profile-stat">
                <div className="stat-icon">📈</div>
                <div>
                  <div className="stat-value">{userData.stats.averageScore}%</div>
                  <div className="stat-label">Average Score</div>
                </div>
              </div>
            </div>
          </div>

          <div className="profile-section">
            <h3>About</h3>
            {isEditing ? (
              <textarea
                name="bio"
                value={editData.bio}
                onChange={handleChange}
                rows="4"
                className="profile-textarea"
              />
            ) : (
              <p>{userData.bio}</p>
            )}
          </div>

          <div className="profile-section">
            <h3>Academic Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Course</span>
                {isEditing ? (
                  <input
                    type="text"
                    name="course"
                    value={editData.course}
                    onChange={handleChange}
                    className="profile-input"
                  />
                ) : (
                  <span className="info-value">{userData.course}</span>
                )}
              </div>
              <div className="info-item">
                <span className="info-label">Semester</span>
                {isEditing ? (
                  <select
                    name="semester"
                    value={editData.semester}
                    onChange={handleChange}
                    className="profile-input"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                ) : (
                  <span className="info-value">{userData.semester}</span>
                )}
              </div>
              <div className="info-item">
                <span className="info-label">University</span>
                {isEditing ? (
                  <input
                    type="text"
                    name="university"
                    value={editData.university}
                    onChange={handleChange}
                    className="profile-input"
                  />
                ) : (
                  <span className="info-value">{userData.university}</span>
                )}
              </div>
              <div className="info-item">
                <span className="info-label">Member Since</span>
                <span className="info-value">{userData.joinDate}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-sidebar">
          <div className="recent-activity-section">
            <h3>Recent Activity</h3>
            <div className="activity-timeline">
              {mockRecentActivity.map((activity) => (
                <div key={activity.id} className="activity-item-profile">
                  <div className="activity-icon-profile">{activity.icon}</div>
                  <div className="activity-content-profile">
                    <p>{activity.description}</p>
                    <span className="activity-time-profile">{activity.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
