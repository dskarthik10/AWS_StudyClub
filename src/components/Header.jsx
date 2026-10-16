import { useState, useEffect, useCallback } from 'react';
import { Search, Bell, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationsService } from '../services/notificationsService';
import { useAuth } from '../auth/useAuth';
import './Header.css';

const NOTIFICATION_ICONS = {
  FRIEND_REQUEST: '👥',
  FRIEND_ACCEPTED: '✅',
  FRIEND_REJECTED: '❌',
  CLUB_INVITE: '✉️',
  CLUB_INVITATION: '✉️',
  CLUB_INVITE_ACCEPTED: '🎉',
  RESOURCE: '📚',
  QUIZ: '✏️',
  EXAM: '📅',
};

function formatRelativeTime(value) {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSeconds < 60) return 'Just now';

  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

  return new Date(value).toLocaleDateString();
}

function mapNotification(notification) {
  return {
    id: notification.notificationId,
    title: notification.title,
    message: notification.message,
    isRead: Boolean(notification.read),
    icon: NOTIFICATION_ICONS[notification.type] || '🔔',
    time: formatRelativeTime(notification.createdAt),
  };
}

export default function Header() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const loadNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    try {
      const data = await notificationsService.getNotifications(30);
      const items = Array.isArray(data.notifications) ? data.notifications : [];
      setNotifications(items.map(mapNotification));
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const toggleNotifications = () => {
    const next = !showNotifications;
    setShowNotifications(next);
    if (next) loadNotifications();
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAsRead = async (id) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    );
    try {
      await notificationsService.markAsRead(id);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await notificationsService.markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="header">
      <div className="header-search">
        <button
          className="search-toggle"
          onClick={() => setShowSearch(!showSearch)}
        >
          <Search size={20} />
        </button>
        {showSearch && (
          <div className="search-popup">
            <input
              type="text"
              placeholder="Search resources, groups, quizzes..."
              className="search-input-popup"
              autoFocus
            />
          </div>
        )}
      </div>

      <div className="header-actions">
        <div className="notification-container">
          <button
            className="header-btn notification-btn"
            onClick={toggleNotifications}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount}</span>
            )}
          </button>

          {showNotifications && (
            <div className="notification-dropdown">
              <div className="notification-header">
                <h3>Notifications</h3>
                {unreadCount > 0 && (
                  <button className="mark-all-read" onClick={handleMarkAllAsRead}>
                    Mark all as read
                  </button>
                )}
              </div>
              <div className="notification-list">
                {loadingNotifications && notifications.length === 0 ? (
                  <div className="notification-empty">
                    <span>⏳</span>
                    <p>Loading notifications...</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="notification-empty">
                    <span>📭</span>
                    <p>No notifications</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`notification-item ${notif.isRead ? 'read' : 'unread'}`}
                      onClick={() => handleMarkAsRead(notif.id)}
                    >
                      <div className="notification-icon">{notif.icon}</div>
                      <div className="notification-content">
                        <p className="notification-title">{notif.title}</p>
                        <p className="notification-message">{notif.message}</p>
                        <span className="notification-time">{notif.time}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="user-menu-container">
          <button
            className="user-menu-btn"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="user-avatar">👤</div>
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-status">{user.email}</span>
            </div>
            <ChevronDown size={16} />
          </button>

          {showUserMenu && (
            <div className="user-dropdown">
              <button onClick={() => { navigate('/profile'); setShowUserMenu(false); }}>
                Profile
              </button>
              <button onClick={() => { navigate('/settings'); setShowUserMenu(false); }}>
                Settings
              </button>
              <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
