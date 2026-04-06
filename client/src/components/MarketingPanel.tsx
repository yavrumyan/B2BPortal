import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Trash2, Upload, ExternalLink, Send, Bell } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Banner {
  id: string;
  imageUrl: string;
  redirectUrl: string | null;
  active: boolean;
  sortOrder: number;
}

export default function MarketingPanel() {
  const { t } = useLanguage();
  const { toast } = useToast();

  // ── Push broadcast state ──
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushUrl, setPushUrl] = useState("");
  const [pushImageUrl, setPushImageUrl] = useState("");
  const [uploadingPushImage, setUploadingPushImage] = useState(false);
  const pushImageInputRef = useRef<HTMLInputElement>(null);

  // ── Banner state ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newBannerUrl, setNewBannerUrl] = useState("");
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // ── Queries ──
  const { data: vapidData } = useQuery<{ publicKey: string | null; subscriberCount?: number }>({
    queryKey: ["/api/push/vapid-key"],
  });

  const { data: banners = [], isLoading: bannersLoading } = useQuery<Banner[]>({
    queryKey: ["/api/admin/banners"],
  });

  // ── Push broadcast mutation ──
  const broadcastMutation = useMutation({
    mutationFn: async (data: { title: string; body: string; url?: string; image?: string }) => {
      return await apiRequest("POST", "/api/admin/push/broadcast", data);
    },
    onSuccess: () => {
      toast({ title: t("push.sent"), description: t("push.sentDesc") });
      setPushTitle("");
      setPushBody("");
      setPushUrl("");
      setPushImageUrl("");
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("push.sendError"), variant: "destructive" });
    },
  });

  // ── Banner mutations ──
  const deleteBannerMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/banners/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners"] });
      toast({ title: t("settings.bannerDeleted") });
    },
    onError: () => toast({ title: t("common.error"), description: t("settings.bannerDeleteError"), variant: "destructive" }),
  });

  const toggleBannerMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) =>
      apiRequest("PATCH", `/api/admin/banners/${id}`, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners"] });
    },
    onError: () => toast({ title: t("common.error"), description: t("settings.bannerUpdateError"), variant: "destructive" }),
  });

  const updateRedirectMutation = useMutation({
    mutationFn: async ({ id, redirectUrl }: { id: string; redirectUrl: string }) =>
      apiRequest("PATCH", `/api/admin/banners/${id}`, { redirectUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners"] });
      toast({ title: t("settings.linkSaved") });
    },
    onError: () => toast({ title: t("common.error"), description: t("settings.linkSaveError"), variant: "destructive" }),
  });

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
      toast({ title: t("settings.bannerAdded") });
    } catch (e: any) {
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleUploadPushImage = async (file: File) => {
    setUploadingPushImage(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/admin/banners", { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      // The banner upload returns the created banner — use its imageUrl
      setPushImageUrl(data.imageUrl);
      // Clean up the banner entry since we only needed the upload
      if (data.id) {
        apiRequest("DELETE", `/api/admin/banners/${data.id}`).catch(() => {});
      }
    } catch (e: any) {
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
    } finally {
      setUploadingPushImage(false);
    }
  };

  const handleSendBroadcast = () => {
    if (!pushTitle.trim() || !pushBody.trim()) return;
    const payload: { title: string; body: string; url?: string; image?: string } = {
      title: pushTitle.trim(),
      body: pushBody.trim(),
    };
    if (pushUrl.trim()) payload.url = pushUrl.trim();
    if (pushImageUrl.trim()) payload.image = pushImageUrl.trim();
    broadcastMutation.mutate(payload);
  };

  const pushConfigured = vapidData?.publicKey != null;
  const subscriberCount = vapidData?.subscriberCount ?? 0;

  return (
    <div className="max-w-2xl space-y-6">
      {/* ── Push Notifications Broadcast ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t("push.broadcastTitle")}
            </CardTitle>
            {pushConfigured && (
              <Badge variant="secondary">
                {t("push.subscriberCount")}: {subscriberCount}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!pushConfigured ? (
            <p className="text-sm text-muted-foreground">{t("push.notConfigured")}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t("push.broadcastDesc")}</p>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("push.messageTitle")}</label>
                <Input
                  placeholder={t("push.messageTitlePlaceholder")}
                  value={pushTitle}
                  onChange={(e) => setPushTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("push.messageBody")}</label>
                <Textarea
                  placeholder={t("push.messageBodyPlaceholder")}
                  value={pushBody}
                  onChange={(e) => setPushBody(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("push.messageUrl")}</label>
                <Input
                  placeholder={t("push.messageUrlPlaceholder")}
                  value={pushUrl}
                  onChange={(e) => setPushUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("push.messageImage")}</label>
                {pushImageUrl ? (
                  <div className="flex items-center gap-2">
                    <img src={pushImageUrl} alt="" className="h-16 w-24 object-cover rounded border" />
                    <Button variant="ghost" size="sm" onClick={() => setPushImageUrl("")}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <input
                      ref={pushImageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadPushImage(file);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => pushImageInputRef.current?.click()}
                      disabled={uploadingPushImage}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingPushImage ? t("settings.uploading") : t("settings.uploadImage")}
                    </Button>
                  </>
                )}
              </div>

              <Button
                onClick={handleSendBroadcast}
                disabled={broadcastMutation.isPending || !pushTitle.trim() || !pushBody.trim()}
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                {broadcastMutation.isPending ? t("push.sending") : t("push.send")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Banner management ── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.banners")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {t("settings.bannersDesc")}
          </p>

          {/* Upload new banner */}
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <p className="text-sm font-medium">{t("settings.addBanner")}</p>
            <Input
              placeholder={t("settings.bannerLink")}
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
              {uploadingBanner ? t("settings.uploading") : t("settings.uploadImage")}
            </Button>
          </div>

          {/* Existing banners list */}
          {bannersLoading ? (
            <p className="text-sm text-muted-foreground">{t("settings.uploading")}</p>
          ) : banners.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("settings.noBanners")}</p>
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
  const { t } = useLanguage();
  const [url, setUrl] = useState(banner.redirectUrl || "");

  return (
    <div className="flex gap-3 items-start border rounded-lg p-3 bg-background">
      {/* Thumbnail */}
      <a href={banner.imageUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
        <img
          src={banner.imageUrl}
          alt={t("settings.bannerOrder")}
          className="h-16 w-24 object-cover rounded border hover:opacity-80 transition-opacity"
        />
      </a>

      {/* Controls */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder={t("settings.bannerClickUrl")}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="text-xs h-8"
          />
          <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => onSaveUrl(url)}>
            <ExternalLink className="h-3 w-3 mr-1" /> {t("settings.save")}
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
              {banner.active ? t("settings.active") : t("settings.hidden")}
            </label>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3 mr-1" /> {t("settings.delete")}
          </Button>
        </div>
      </div>
    </div>
  );
}
