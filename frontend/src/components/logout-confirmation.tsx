"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LogOut, AlertTriangle } from "lucide-react";

interface LogoutConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userName?: string;
}

export function LogoutConfirmation({ 
  isOpen, 
  onClose, 
  onConfirm, 
  userName 
}: LogoutConfirmationProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleConfirm = async () => {
    setIsLoggingOut(true);
    try {
      await onConfirm();
    } finally {
      setIsLoggingOut(false);
      onClose();
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Confirmer la déconnexion
          </AlertDialogTitle>
          <AlertDialogDescription>
            {userName ? (
              <>
                Êtes-vous sûr de vouloir vous déconnecter, <strong>{userName}</strong> ?
                <br />
                <br />
                Vous devrez vous reconnecter pour accéder à nouveau à l'application.
              </>
            ) : (
              <>
                Êtes-vous sûr de vouloir vous déconnecter ?
                <br />
                <br />
                Vous devrez vous reconnecter pour accéder à nouveau à l'application.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoggingOut}>
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoggingOut}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoggingOut ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Déconnexion...
              </>
            ) : (
              <>
                <LogOut className="mr-2 h-4 w-4" />
                Se déconnecter
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
