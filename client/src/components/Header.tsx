import { ShoppingCart, User, LogOut, Settings, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import logoPath from "@assets/LOG_1763806953898.png";

interface HeaderProps {
  cartItemCount?: number;
  onCartClick?: () => void;
  onMenuClick?: () => void;
}

export default function Header({
  cartItemCount = 0,
  onCartClick,
  onMenuClick,
}: HeaderProps) {
  const { customer, isAuthenticated, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Выход выполнен",
        description: "Вы успешно вышли из системы",
      });
      setLocation("/");
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось выйти из системы",
        variant: "destructive",
      });
    },
  });

  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {onMenuClick && (
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={onMenuClick}
                data-testid="button-open-customer-sidebar"
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && customer ? (
              <>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLocation("/admin")}
                    data-testid="button-admin-panel"
                  >
                    <Settings className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">chip.am</span>
                    <Badge variant="secondary" className="ml-1 text-xs">Admin</Badge>
                  </Button>
                )}
                {!isAdmin && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-customer-name">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">{customer.companyName}</span>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Выход</span>
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/login")}
                data-testid="button-login"
              >
                <User className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Вход</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={onCartClick}
              data-testid="button-cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartItemCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full px-1 text-xs"
                  data-testid="badge-cart-count"
                >
                  {cartItemCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
