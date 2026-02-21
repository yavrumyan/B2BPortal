import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Settings } from "@shared/schema";

export default function SettingsPanel() {
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
      toast({
        title: "Успешно",
        description: "Настройки надбавок обновлены. Все цены пересчитаны.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить настройки",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (formData.corporateMarkupPercentage < 0 || formData.corporateMarkupPercentage > 100) {
      toast({
        title: "Ошибка",
        description: "Надбавка для корпоративных клиентов должна быть от 0 до 100%",
        variant: "destructive",
      });
      return;
    }

    if (formData.governmentMarkupPercentage < 0 || formData.governmentMarkupPercentage > 100) {
      toast({
        title: "Ошибка",
        description: "Надбавка для гос. учреждений должна быть от 0 до 100%",
        variant: "destructive",
      });
      return;
    }

    updateSettingsMutation.mutate(formData);
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Загрузка настроек...</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Настройки системы</h1>

      <Card>
        <CardHeader>
          <CardTitle>Надбавки на цены</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Надбавка для корпоративных клиентов (%)
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Цена = Базовая цена × (1 + процент / 100), округлено к 100 вверх
            </p>
            <Input
              type="number"
              min="0"
              max="100"
              value={formData.corporateMarkupPercentage}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  corporateMarkupPercentage: parseInt(e.target.value) || 0,
                })
              }
              data-testid="input-corporate-markup"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Надбавка для гос. учреждений (%)
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Цена = Базовая цена × (1 + процент / 100), округлено к 100 вверх
            </p>
            <Input
              type="number"
              min="0"
              max="100"
              value={formData.governmentMarkupPercentage}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  governmentMarkupPercentage: parseInt(e.target.value) || 0,
                })
              }
              data-testid="input-government-markup"
            />
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm">
              <strong>Примечание:</strong> При изменении этих значений все цены для корпоративных и гос. клиентов будут автоматически пересчитаны. Цены для дилеров (базовые цены) не изменяются.
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={updateSettingsMutation.isPending}
            data-testid="button-save-settings"
            className="w-full"
          >
            {updateSettingsMutation.isPending ? "Сохранение..." : "Сохранить"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
