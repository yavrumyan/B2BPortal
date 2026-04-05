import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation, useSearch } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const { t } = useLanguage();
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
        title: t("reset.changed"),
        description: t("reset.changedDesc"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message || t("reset.changeError"),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        title: t("common.error"),
        description: t("reset.tooShort"),
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: t("common.error"),
        description: t("reset.mismatch"),
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
            <CardTitle className="text-2xl">{t("reset.invalidLink")}</CardTitle>
            <CardDescription>
              {t("reset.invalidLinkDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => setLocation("/recover-password")}
              data-testid="button-request-new-link"
            >
              {t("reset.requestNew")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Сброс пароля | CHIP Technologies B2B</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
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
            <CardTitle className="text-2xl">{t("reset.title")}</CardTitle>
          </div>
          <CardDescription>
            {t("reset.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isReset ? (
            <div className="text-center space-y-4 py-4">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
              <p className="text-sm text-muted-foreground">
                {t("reset.success")}
              </p>
              <Button
                className="w-full"
                onClick={() => setLocation("/login")}
                data-testid="button-go-to-login"
              >
                {t("reset.signIn")}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">{t("reset.newPassword")}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t("reset.newPasswordHint")}
                  data-testid="input-new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("reset.confirmPassword")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder={t("reset.confirmPlaceholder")}
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
                {resetMutation.isPending ? t("reset.submitting") : t("reset.submit")}
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
            {t("reset.rememberPassword")} {t("reset.signIn")}
          </button>
        </CardFooter>
      </Card>
    </div>
    </>
  );
}
