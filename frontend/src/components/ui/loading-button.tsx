import { Button, ButtonProps } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils";

interface LoadingButtonProps extends Omit<ButtonProps, 'children'> {
  isLoading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export function LoadingButton({ 
  isLoading = false, 
  loadingText,
  children,
  className,
  disabled,
  ...props 
}: LoadingButtonProps) {
  return (
    <Button
      {...props}
      disabled={disabled || isLoading}
      className={cn(className)}
    >
      {isLoading ? (
        <>
          <LoadingSpinner size="sm" className="mr-2" />
          {loadingText || "Chargement..."}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
