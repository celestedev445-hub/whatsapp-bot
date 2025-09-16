"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  username: string;
  role: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  requestLogout: () => void;
  isLoading: boolean;
  timeLeft: number;
  extendSession: () => void;
  showLogoutConfirmation: boolean;
  setShowLogoutConfirmation: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [inactivityTimer, setInactivityTimer] = useState<NodeJS.Timeout | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [countdownTimer, setCountdownTimer] = useState<NodeJS.Timeout | null>(null);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);

  // Vérifier l'authentification au chargement
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('auth_token');
      console.log('🔍 Vérification de l\'authentification...', { hasToken: !!storedToken });
      
      if (storedToken) {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
          console.log('🌐 Vérification du token via:', `${apiUrl}/api/auth/verify`);
          
          // Vérifier la validité du token
          const response = await fetch(`${apiUrl}/api/auth/verify`, {
            headers: {
              'Authorization': `Bearer ${storedToken}`,
            },
          });

          console.log('📡 Réponse de vérification:', { status: response.status, ok: response.ok });

          if (response.ok) {
            const data = await response.json();
            console.log('✅ Token valide:', data);
            if (data.success) {
              setToken(storedToken);
              setUser(data.data.user);
              setIsAuthenticated(true);
              console.log('🔐 Utilisateur connecté:', data.data.user);
            } else {
              console.log('❌ Token invalide selon la réponse');
              localStorage.removeItem('auth_token');
            }
          } else {
            console.log('❌ Erreur HTTP lors de la vérification');
            localStorage.removeItem('auth_token');
          }
        } catch (error) {
          console.error('❌ Erreur lors de la vérification du token:', error);
          localStorage.removeItem('auth_token');
        }
      } else {
        console.log('❌ Aucun token trouvé dans localStorage');
      }
      
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  // Le localStorage n'est nettoyé que lors de la déconnexion manuelle ou automatique (inactivité)
  // Pas de nettoyage à la fermeture d'onglet pour éviter les reconnexions à chaque actualisation

  // Gestion de l'inactivité et déconnexion automatique
  useEffect(() => {
    if (!isAuthenticated) return;

    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes en millisecondes
    let currentInactivityTimer: NodeJS.Timeout | null = null;
    let currentCountdownTimer: NodeJS.Timeout | null = null;

    const resetInactivityTimer = () => {
      setLastActivity(Date.now());
      setTimeLeft(INACTIVITY_TIMEOUT);
      
      // Nettoyer les timers précédents
      if (currentInactivityTimer) {
        clearTimeout(currentInactivityTimer);
      }
      if (currentCountdownTimer) {
        clearInterval(currentCountdownTimer);
      }

      // Créer un nouveau timer de déconnexion
      currentInactivityTimer = setTimeout(() => {
        console.log('🔒 Déconnexion automatique due à l\'inactivité');
        // Déconnexion automatique sans confirmation
        localStorage.removeItem('auth_token');
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
        setTimeLeft(0);
      }, INACTIVITY_TIMEOUT);

      setInactivityTimer(currentInactivityTimer);

      // Créer un countdown pour l'affichage
      currentCountdownTimer = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1000;
          if (newTime <= 0) {
            clearInterval(currentCountdownTimer!);
            return 0;
          }
          return newTime;
        });
      }, 1000);

      setCountdownTimer(currentCountdownTimer);
    };

    // Événements qui indiquent une activité
    const activityEvents = [
      'mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'
    ];

    // Ajouter les écouteurs d'événements
    activityEvents.forEach(event => {
      document.addEventListener(event, resetInactivityTimer, true);
    });

    // Initialiser le timer
    resetInactivityTimer();

    // Nettoyage
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer, true);
      });
      if (currentInactivityTimer) {
        clearTimeout(currentInactivityTimer);
      }
      if (currentCountdownTimer) {
        clearInterval(currentCountdownTimer);
      }
    };
  }, [isAuthenticated]);

  const login = (newToken: string, userData?: any) => {
    setToken(newToken);
    setIsAuthenticated(true);
    if (userData) {
      setUser(userData);
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setTimeLeft(0);
    
    // Nettoyer les timers
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }
    if (countdownTimer) {
      clearInterval(countdownTimer);
    }
  };

  const extendSession = () => {
    // Réinitialiser le timer d'inactivité en déclenchant un événement
    const event = new Event('mousedown');
    document.dispatchEvent(event);
  };

  const requestLogout = () => {
    setShowLogoutConfirmation(true);
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      token,
      login,
      logout,
      requestLogout,
      isLoading,
      timeLeft,
      extendSession,
      showLogoutConfirmation,
      setShowLogoutConfirmation
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
