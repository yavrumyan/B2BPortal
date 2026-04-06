import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Settings } from "@shared/schema";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SettingsPanel() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    corporateMarkupPercentage: 10,
    governmentMarkupPercentage: 10,
  });

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        corporateMarkupPercentage: settings.corporateMarkupPercentage,
        governmentMarkupPercentage: settings.governmentMarkupPercentage,
      });
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { corporateMarkupPercentage: number; governmentMarkupPercentage: number }) => {
      return await apiRequest("PATCH", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: t("settings.saved"), description: t("settings.savedDesc") });
    },
    onError: (error: any) => {
      toast({ title: t("common.error"), description: error.message || t("settings.saveError"), variant: "destructive" });
    },
  });

  const handleSaveMarkups = () => {
    if (formData.corporateMarkupPercentage < 0 || formData.corporateMarkupPercentage > 100) {
      toast({ title: t("common.error"), description: t("settings.corpMarkupError"), variant: "destructive" });
      return;
    }
    if (formData.governmentMarkupPercentage < 0 || formData.governmentMarkupPercentage > 100) {
      toast({ title: t("common.error"), description: t("settings.govMarkupError"), variant: "destructive" });
      return;
    }
    updateSettingsMutation.mutate(formData);
  };

  if (isLoading) return <div className="text-muted-foreground">{t("settings.loading")}</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>

      {/* ── Price markups ── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.markups")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("settings.corporateMarkup")}</label>
            <p className="text-xs text-muted-foreground mb-2">
              {t("settings.corporateFormula")}
            </p>
            <Input
              type="number" min="0" max="100"
              value={formData.corporateMarkupPercentage}
              onChange={(e) => setFormData({ ...formData, corporateMarkupPercentage: parseInt(e.target.value) || 0 })}
              data-testid="input-corporate-markup"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t("settings.governmentMarkup")}</label>
            <p className="text-xs text-muted-foreground mb-2">
              {t("settings.corporateFormula")}
            </p>
            <Input
              type="number" min="0" max="100"
              value={formData.governmentMarkupPercentage}
              onChange={(e) => setFormData({ ...formData, governmentMarkupPercentage: parseInt(e.target.value) || 0 })}
              data-testid="input-government-markup"
            />
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm">
              <strong>{t("settings.markupNote")}</strong> {t("settings.markupNoteText")}
            </p>
          </div>

          <Button onClick={handleSaveMarkups} disabled={updateSettingsMutation.isPending} className="w-full" data-testid="button-save-settings">
            {updateSettingsMutation.isPending ? t("settings.saving") : t("settings.save")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
