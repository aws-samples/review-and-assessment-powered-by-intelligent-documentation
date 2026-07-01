import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Amplify } from 'aws-amplify';
import { signIn, signOut, getCurrentUser, fetchUserAttributes, fetchAuthSession } from 'aws-amplify/auth';

// 環境変数から設定を取得
// CDKのbuildViteAppで設定される環境変数名に合わせる
const region = import.meta.env.VITE_APP_REGION || 'ap-northeast-1';
const userPoolId = import.meta.env.VITE_APP_USER_POOL_ID;
const userPoolWebClientId = import.meta.env.VITE_APP_USER_POOL_CLIENT_ID;

// Amplify設定 - v6形式に修正
Amplify.configure({
  Auth: {
    Cognito: {
      region,
      userPoolId,
      userPoolClientId: userPoolWebClientId
    }
  }
});

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any | null;
  signIn: (username: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  checkAuthState: () => Promise<void>; // 追加
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    checkAuthState();
  }, []);

  async function checkAuthState() {
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      setUser({ ...currentUser, ...attributes });
      setIsAuthenticated(true);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignIn(username: string, password: string) {
    try {
      const user = await signIn({ username, password });
      await checkAuthState();
      return user;
    } catch (error) {
      throw error;
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  async function getIdToken(): Promise<string | null> {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() || null;
    } catch (error) {
      console.error('Error getting ID token:', error);
      return null;
    }
  }

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isLoading,
      user,
      signIn: handleSignIn,
      signOut: handleSignOut,
      getIdToken,
      checkAuthState // 追加
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
