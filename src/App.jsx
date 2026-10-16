import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.jsx';
import { ProtectedRoute, PublicOnlyRoute } from './auth/RouteGuards';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import ResourceLibrary from './pages/ResourceLibrary';
import ResourceDetails from './pages/ResourceDetails';
import UploadResource from './pages/UploadResource';
import ExamPrep from './pages/ExamPrep';
import Quiz from './pages/Quiz';
import QuizResults from './pages/QuizResults';
import StudyGroups from './pages/StudyGroups';
import StudyGroupDetails from './pages/StudyGroupDetails';
import Friends from './pages/Friends';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Login from './pages/auth/Login';
import SignUp from './pages/auth/SignUp';
import VerifyEmail from './pages/auth/VerifyEmail';
import ForgotPassword from './pages/auth/ForgotPassword';
import SetNewPassword from './pages/auth/SetNewPassword';
import './App.css';

function AppLayout() {
  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content"><Header /><Outlet /></main>
    </div>
  );
}

function App() {
  return <AuthProvider><Router><Routes>
    <Route element={<PublicOnlyRoute />}>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/set-new-password" element={<SetNewPassword />} />
    </Route>
    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/resources" element={<ResourceLibrary />} />
        <Route path="/resources/:id" element={<ResourceDetails />} />
        <Route path="/upload" element={<UploadResource />} />
        <Route path="/exams" element={<ExamPrep />} />
        <Route path="/quiz/:id" element={<Quiz />} />
        <Route path="/quiz/:id/results" element={<QuizResults />} />
        <Route path="/study-groups" element={<StudyGroups />} />
        <Route path="/study-groups/:id" element={<StudyGroupDetails />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Router></AuthProvider>;
}

export default App;
