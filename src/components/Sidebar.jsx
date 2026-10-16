import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, BookOpen, Upload, GraduationCap, Users, UserPlus, User, Settings, HelpCircle, LogOut, X } from 'lucide-react';
import './Sidebar.css';
import { useAuth } from '../auth/useAuth';

export default function Sidebar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
    { id: 'resources', label: 'Resource Library', icon: BookOpen, path: '/resources' },
    { id: 'upload', label: 'Upload Resource', icon: Upload, path: '/upload' },
    { id: 'exams', label: 'Exam Prep', icon: GraduationCap, path: '/exams' },
    { id: 'groups', label: 'Study Groups', icon: Users, path: '/study-groups' },
    { id: 'friends', label: 'Friends', icon: UserPlus, path: '/friends' },
    { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
  ];

  const handleNavClick = (path) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <button
        className="mobile-menu-toggle"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle menu"
      >
        ☰
      </button>

      <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">🎓</div>
            <h2>AI StudyClub</h2>
          </div>
          <button
            className="mobile-close"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <item.icon size={20} className="nav-icon" />
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="footer-item" onClick={() => handleNavClick('/settings')}>
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <button className="footer-item">
            <HelpCircle size={18} />
            <span>Help</span>
          </button>
          <button className="footer-item logout" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
