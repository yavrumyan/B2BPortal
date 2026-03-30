import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Settings } from "@shared/schema";
import { Trash2, Upload, ExternalLink } from "lucide-react";

interface Banner {
  id: string;
  imageUrl: string;
  redirectUrl: string | null;
  active: boolean;
  sortOrder: number;
}

export default function SettingsPanel() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    corporateMarkupPercentage: 10,
    governmentMarkupPercentage: 10,
  });
  const [newBannerUrl, setNewBannerUrl] = useState("");
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const { data: banners = [], isLoading: bannersLoading } = useQuery<Banner[]>({
    queryKey: ["/api/admin/banners"],
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
      toast({ title: "Успешно", description: "Настройки надбавок обновлены. Все цены пересчитаны." });
    },
    onError: (error: any) => {
      toast({ title: "Ошибка", description: error.message || "Не удалось обновить настройки", variant: "destructive" });
    },
  });

  const deleteBannerMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/banners/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners"] });
      toast({ title: "Баннер удалён" });
    },
    onError: () => toast({ title: "Ошибка", description: "Не удалось удалить баннер", variant: "destructive" }),
  });

  const toggleBannerMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) =>
      apiRequest("PATCH", `/api/admin/banners/${id}`, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners"] });
    },
    onError: () => toast({ title: "Ошибка", description: "Не удалось обновить баннер", variant: "destructive" }),
  });

  const updateRedirectMutation = useMutation({
    mutationFn: async ({ id, redirectUrl }: { id: string; redirectUrl: string }) =>
      apiRequest("PATCH", `/api/admin/banners/${id}`, { redirectUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners"] });
      toast({ title: "Ссылка сохранена" });
    },
    onError: () => toast({ title: "Ошибка", description: "Не удалось сохранить ссылку", variant: "destructive" }),
  });

  const handleSaveMarkups = () => {
    if (formData.corporateMarkupPercentage < 0 || formData.corporateMarkupPercentage > 100) {
      toast({ title: "Ошибка", description: "Надбавка для корпоративных клиентов должна быть от 0 до 100%", variant: "destructive" });
      return;
    }
    if (formData.governmentMarkupPercentage < 0 || formData.governmentMarkupPercentage > 100) {
      toast({ title: "Ошибка", description: "Надбавка для гос. учреждений должна быть от 0 до 100%", variant: "destructive" });
      return;
    }
    updateSettingsMutation.mutate(formData);
  };

  const handleUploadBanner = async (file: File) => {
    setUploadingBanner(true);
    try {
      const form = new FormData();
      form.append("image", file);
      if (newBannerUrl.trim()) form.append("redirectUrl", newBannerUrl.trim());
      const res = await fetch("/api/admin/banners", { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json()).message || "Upload failed");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners"] });
      setNewBannerUrl("");
      toast({ title: "Баннер добавлен" });
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setUploadingBanner(false);
    }
  };

  if (isLoading) return <div className="text-muted-foreground">Загрузка настроек...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Настройки системы</h1>

      {/* ── Price markups ── */}
      <Card>
        <CardHeader>
          <CardTitle>Надбавки на цены</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Надбавка для корпоративных клиентов (%)</label>
            <p className="text-xs text-muted-foreground mb-2">
              Цена = Базовая цена × (1 + процент / 100), округлено к 100 вверх
            </p>
            <Input
              type="number" min="0" max="100"
              value={formData.corporateMarkupPercentage}
              onChange={(e) => setFormData({ ...formData, corporateMarkupPercentage: parseInt(e.target.value) || 0 })}
              data-testid="input-corporate-markup"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Надбавка для гос. учреждений (%)</label>
            <p className="text-xs text-muted-foreground mb-2">
              Цена = Базовая цена × (1 + процент / 100), округлено к 100 вверх
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
              <strong>Примечание:</strong> При изменении этих значений все цены для корпоративных и гос. клиентов будут автоматически пересчитаны. Цены для дилеров (базовые цены) не изменяются.
            </p>
          </div>

          <Button onClick={handleSaveMarkups} disabled={updateSettingsMutation.isPending} className="w-full" data-testid="button-save-settings">
            {updateSettingsMutation.isPending ? "Сохранение..." : "Сохранить"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Banner management ── */}
      <Card>
        <CardHeader>
          <CardTitle>Рекламные баннеры</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Баннеры отображаются всем посетителям главной страницы в виде карусели. Порядок определяется полем «Порядок».
          </p>

          {/* Upload new banner */}
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <p className="text-sm font-medium">Добавить баннер</p>
            <Input
              placeholder="Ссылка при клике (необязательно)"
              value={newBannerUrl}
              onChange={(e) => setNewBannerUrl(e.target.value)}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadBanner(file);
                e.target.value = "";
              }}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingBanner}
              className="w-full"
              variant="outline"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadingBanner ? "Загрузка..." : "Выбрать изображение и загрузить"}
            </Button>
          </div>

          {/* Existing banners list */}
          {bannersLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : banners.length === 0 ? (
            <p className="text-sm text-muted-foreground">Баннеров пока нет.</p>
          ) : (
            <div className="space-y-3">
              {banners.map((banner) => (
                <BannerRow
                  key={banner.id}
                  banner={banner}
                  onToggle={(active) => toggleBannerMutation.mutate({ id: banner.id, active })}
                  onSaveUrl={(url) => updateRedirectMutation.mutate({ id: banner.id, redirectUrl: url })}
                  onDelete={() => deleteBannerMutation.mutate(banner.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BannerRow({
  banner,
  onToggle,
  onSaveUrl,
  onDelete,
}: {
  banner: Banner;
  onToggle: (active: boolean) => void;
  onSaveUrl: (url: string) => void;
  onDelete: () => void;
}) {
  const [url, setUrl] = useState(banner.redirectUrl || "");

  return (
    <div className="flex gap-3 items-start border rounded-lg p-3 bg-background">
      {/* Thumbnail */}
      <a href={banner.imageUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
        <img
          src={banner.imageUrl}
          alt="баннер"
          className="h-16 w-24 object-cover rounded border hover:opacity-80 transition-opacity"
        />
      </a>

      {/* Controls */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Ссылка при клике"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="text-xs h-8"
          />
          <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => onSaveUrl(url)}>
            <ExternalLink className="h-3 w-3 mr-1" /> Сохранить
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={banner.active}
              onCheckedChange={onToggle}
              id={`active-${banner.id}`}
            />
            <label htmlFor={`active-${banner.id}`} className="text-xs cursor-pointer">
              {banner.active ? "Активен" : "Скрыт"}
            </label>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3 mr-1" /> Удалить
          </Button>
        </div>
      </div>
    </div>
  );
}
