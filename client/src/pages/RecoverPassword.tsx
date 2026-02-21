import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

export default function RecoverPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const recoverMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/auth/recover-password", { email });
    },
    onSuccess: () => {
      setIsSubmitted(true);
      toast({
        title: "Запрос отправлен",
        description: "Инструкции отправлены на ваш email",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отправить запрос",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    recoverMutation.mutate();
  };

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
            <CardTitle className="text-2xl">Восстановление пароля</CardTitle>
          </div>
          <CardDescription>
            Введите ваш email для получения инструкций по восстановлению доступа
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSubmitted ? (
            <div className="text-center space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Если аккаунт с email <strong>{email}</strong> существует, мы отправили на него инструкции по восстановлению пароля.
              </p>
              <Button 
                className="w-full" 
                onClick={() => setLocation("/login")}
                data-testid="button-return-login"
              >
                Вернуться к входу
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  data-testid="input-recovery-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                data-testid="button-submit-recovery"
                disabled={recoverMutation.isPending}
              >
                {recoverMutation.isPending ? "Отправка..." : "Восстановить"}
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
