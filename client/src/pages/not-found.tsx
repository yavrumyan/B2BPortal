import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold">{t("notFound.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("notFound.description")}
          </p>
          <Button variant="outline" onClick={() => window.history.back()}>
            {t("notFound.goBack")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
