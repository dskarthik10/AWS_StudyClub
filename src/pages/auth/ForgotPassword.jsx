import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import './AuthPages.css';

export default function ForgotPassword() {
  const { requestPasswordReset, completePasswordReset } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.fromSignIn ? 'Your password needs to be reset. Request a verification code below.' : '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function sendCode(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const result = await requestPasswordReset(email);
      if (result.nextStep.resetPasswordStep === 'CONFIRM_RESET_PASSWORD_WITH_CODE') {
        setCodeSent(true);
        setNotice('A password-reset code has been sent to your email.');
      }
    } catch (authError) {
      setError(authError.message || 'We could not start the password reset.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resetPassword(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await completePasswordReset(email, code, newPassword);
      navigate('/login', { replace: true });
    } catch (authError) {
      setError(authError.message || 'We could not reset your password.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="auth-page"><section className="auth-card">
    <div className="auth-brand"><span className="auth-brand-icon">🔐</span><h1>Reset your password</h1><p>{codeSent ? 'Enter the code from your email and choose a new password.' : 'We will email you a verification code.'}</p></div>
    {notice && <p className="auth-notice" role="status">{notice}</p>}
    {!codeSent ? <form className="auth-form" onSubmit={sendCode}>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <label className="auth-field">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
      <button className="auth-submit" disabled={isSubmitting}>{isSubmitting ? 'Sending…' : 'Send reset code'}</button>
    </form> : <form className="auth-form" onSubmit={resetPassword}>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <label className="auth-field">Verification code<input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" inputMode="numeric" required /></label>
      <label className="auth-field">New password<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength="8" required /></label>
      <button className="auth-submit" disabled={isSubmitting}>{isSubmitting ? 'Resetting…' : 'Reset password'}</button>
    </form>}
    <p className="auth-footer"><Link className="auth-link" to="/login">Back to sign in</Link></p>
  </section></main>;
}
