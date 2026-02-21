import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isReset, setIsReset] = useState(false);

  const params = new URLSearchParams(searchString);
  const token = params.get("token");

  const resetMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/auth/reset-password", { token, password });
    },
    onSuccess: () => {
      setIsReset(true);
      toast({
        title: "Пароль изменён",
        description: "Теперь вы можете войти с новым паролем",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сбросить пароль",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        title: "Ошибка",
        description: "Пароль должен быть не менее 6 символов",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Ошибка",
        description: "Пароли не совпадают",
        variant: "destructive",
      });
      return;
    }

    resetMutation.mutate();
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Недействительная ссылка</CardTitle>
            <CardDescription>
              Ссылка для восстановления пароля недействительна или отсутствует.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => setLocation("/recover-password")}
              data-testid="button-request-new-link"
            >
              Запросить новую ссылку
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/login")}
              data-testid="button-back-to-login"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-2xl">Новый пароль</CardTitle>
          </div>
          <CardDescription>
            Введите новый пароль для вашего аккаунта
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isReset ? (
            <div className="text-center space-y-4 py-4">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Пароль успешно изменён. Теперь вы можете войти с новым паролем.
              </p>
              <Button
                className="w-full"
                onClick={() => setLocation("/login")}
                data-testid="button-go-to-login"
              >
                Войти
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Новый пароль</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Минимум 6 символов"
                  data-testid="input-new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Повторите пароль"
                  data-testid="input-confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                data-testid="button-submit-reset"
                disabled={resetMutation.isPending}
              >
                {resetMutation.isPending ? "Сохранение..." : "Установить новый пароль"}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="justify-center">
          <button
            type="button"
            onClick={() => setLocation("/login")}
            className="text-sm text-primary hover:underline"
            data-testid="link-back-login"
          >
            Вспомнили пароль? Войти
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
