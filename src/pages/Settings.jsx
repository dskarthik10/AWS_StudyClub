import { useState, useEffect } from 'react';
import { Moon, Sun, Bell, User, Shield } from 'lucide-react';
import Toast from '../components/Toast';
import './Settings.css';

export default function Settings() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [settings, setSettings] = useState({
    emailNotifications: true,
    quizReminders: true,
    groupNotifications: true,
    resourceUpdates: false,
  });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleThemeToggle = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    setToast({ message: `Switched to ${newTheme} mode`, type: 'success' });
  };

  const handleSettingChange = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    setToast({ message: 'Settings updated', type: 'success' });
  };

  return (
    <div className="settings">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your account preferences</p>
      </div>

      <div className="settings-container">
        <div className="settings-section">
          <div className="section-icon">
            <User size={24} />
          </div>
          <div className="section-content">
            <h2>Account</h2>
            <p className="section-description">Manage your account information</p>

            <div className="settings-item">
              <div className="item-info">
                <h4>Email</h4>
                <p>student@example.com</p>
              </div>
              <button className="change-btn">Change</button>
            </div>

            <div className="settings-item">
              <div className="item-info">
                <h4>Password</h4>
                <p>••••••••</p>
              </div>
              <button className="change-btn">Change</button>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="section-icon">
            {theme === 'dark' ? <Moon size={24} /> : <Sun size={24} />}
          </div>
          <div className="section-content">
            <h2>Appearance</h2>
            <p className="section-description">Customize how AI StudyClub looks</p>

            <div className="settings-item">
              <div className="item-info">
                <h4>Theme</h4>
                <p>Choose your preferred theme</p>
              </div>
              <button className="theme-toggle" onClick={handleThemeToggle}>
                <span className={`toggle-option ${theme === 'light' ? 'active' : ''}`}>
                  <Sun size={16} /> Light
                </span>
                <span className={`toggle-option ${theme === 'dark' ? 'active' : ''}`}>
                  <Moon size={16} /> Dark
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="section-icon">
            <Bell size={24} />
          </div>
          <div className="section-content">
            <h2>Notifications</h2>
            <p className="section-description">Control what notifications you receive</p>

            <div className="settings-item">
              <div className="item-info">
                <h4>Email Notifications</h4>
                <p>Receive important updates via email</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={() => handleSettingChange('emailNotifications')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="settings-item">
              <div className="item-info">
                <h4>Quiz Reminders</h4>
                <p>Get notified about upcoming quizzes</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.quizReminders}
                  onChange={() => handleSettingChange('quizReminders')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="settings-item">
              <div className="item-info">
                <h4>Study Group Notifications</h4>
                <p>Updates from your study groups</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.groupNotifications}
                  onChange={() => handleSettingChange('groupNotifications')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="settings-item">
              <div className="item-info">
                <h4>Resource Updates</h4>
                <p>Notifications for new resources</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.resourceUpdates}
                  onChange={() => handleSettingChange('resourceUpdates')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="section-icon">
            <Shield size={24} />
          </div>
          <div className="section-content">
            <h2>Privacy & Security</h2>
            <p className="section-description">Manage your privacy settings</p>

            <div className="settings-item">
              <div className="item-info">
                <h4>Profile Visibility</h4>
                <p>Control who can see your profile</p>
              </div>
              <select className="privacy-select">
                <option>Everyone</option>
                <option>Group Members Only</option>
                <option>Private</option>
              </select>
            </div>

            <div className="settings-item">
              <div className="item-info">
                <h4>Activity Status</h4>
                <p>Show when you're online</p>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" defaultChecked />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div className="danger-zone">
          <h3>Danger Zone</h3>
          <button className="danger-btn">Delete Account</button>
        </div>
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
