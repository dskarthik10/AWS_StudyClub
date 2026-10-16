import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  confirmSignUp,
  confirmResetPassword,
  confirmSignIn,
  fetchUserAttributes,
  getCurrentUser,
  resendSignUpCode,
  resetPassword,
  signIn,
  signOut,
  signUp,
} from 'aws-amplify/auth';
import './amplify';
import { AuthContext } from './authContext';

function toAppUser(cognitoUser, attributes) {
  const email = attributes.email || cognitoUser.username;
  return {
    id: cognitoUser.userId,
    email,
    name: attributes.name || attributes.given_name || email,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const cognitoUser = await getCurrentUser();
    const attributes = await fetchUserAttributes();
    const appUser = toAppUser(cognitoUser, attributes);
    setUser(appUser);
    return appUser;
  }, []);

  useEffect(() => {
    let isActive = true;

    async function restoreSession() {
      try {
        const cognitoUser = await getCurrentUser();
        const attributes = await fetchUserAttributes();
        if (isActive) setUser(toAppUser(cognitoUser, attributes));
      } catch {
        // No valid Cognito session is expected for signed-out visitors.
        if (isActive) setUser(null);
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    restoreSession();
    return () => {
      isActive = false;
    };
  }, []);

  const value = useMemo(() => ({
    user,
    isLoading,
    async login(email, password) {
      const result = await signIn({
        username: email.trim(),
        password,
        options: { authFlowType: 'USER_SRP_AUTH' },
      });
      if (result.isSignedIn) await refreshUser();
      return result;
    },
    async register({ name, email, password }) {
      return signUp({
        username: email.trim(),
        password,
        options: {
          userAttributes: {
            email: email.trim(),
            ...(name.trim() ? { name: name.trim() } : {}),
          },
        },
      });
    },
    async verifyEmail(email, code) {
      return confirmSignUp({ username: email.trim(), confirmationCode: code.trim() });
    },
    async completeNewPassword(name, newPassword) {
      const result = await confirmSignIn({
        challengeResponse: newPassword,
        options: { userAttributes: { name: name.trim() } },
      });
      if (result.isSignedIn) await refreshUser();
      return result;
    },
    async requestPasswordReset(email) {
      return resetPassword({ username: email.trim() });
    },
    async completePasswordReset(email, code, newPassword) {
      return confirmResetPassword({
        username: email.trim(),
        confirmationCode: code.trim(),
        newPassword,
      });
    },
    async resendVerificationCode(email) {
      return resendSignUpCode({ username: email.trim() });
    },
    async logout() {
      await signOut();
      setUser(null);
    },
  }), [isLoading, refreshUser, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
