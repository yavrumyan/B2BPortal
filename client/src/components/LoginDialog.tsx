import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const loginSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin?: (data: LoginFormData) => void;
  onRegisterClick?: () => void;
}

export default function LoginDialog({
  isOpen,
  onClose,
  onLogin,
  onRegisterClick,
}: LoginDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    console.log("Login data:", data);
    onLogin?.(data);
    setTimeout(() => {
      setIsSubmitting(false);
      onClose();
    }, 1000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-login">
        <DialogHeader>
          <DialogTitle>Вход в B2B портал</DialogTitle>
          <DialogDescription>
            Введите ваши данные для входа в систему
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="ivan@example.com"
                      {...field}
                      data-testid="input-login-email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Пароль</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••"
                      {...field}
                      data-testid="input-login-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
                data-testid="button-submit-login"
              >
                {isSubmitting ? "Вход..." : "Войти"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={onRegisterClick}
                data-testid="button-register"
              >
                Зарегистрироваться
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
