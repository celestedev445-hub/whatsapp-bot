"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoginPage } from "@/components/login-page";
import { useAuth } from "@/contexts/auth-context";

export default function Login() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleLoginSuccess = (token: string, user?: any) => {
    setIsLoading(true);
    // Appeler la fonction login du contexte avec l'utilisateur
    login(token, user);
    // Rediriger vers la page principale après connexion
    setTimeout(() => {
      router.push('/');
    }, 1000);
  };

  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
}
