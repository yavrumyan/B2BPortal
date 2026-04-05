import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBusinessRegistrationSchema } from "@shared/schema";
import type { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";

type RegistrationFormData = z.infer<typeof insertBusinessRegistrationSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();

  const form = useForm<RegistrationFormData>({
    resolver: zodResolver(insertBusinessRegistrationSchema),
    defaultValues: {
      companyName: "",
      taxId: "",
      deliveryAddress: "",
      bankName: "",
      bankAccount: "",
      representativeName: "",
      email: "",
      phone: "",
      messenger: "telegram",
      messengerContact: "",
      password: "",
    },
  });

  const registrationMutation = useMutation({
    mutationFn: async (data: RegistrationFormData) => {
      return await apiRequest("POST", "/api/registrations", data);
    },
    onSuccess: () => {
      // Fire Google Ads conversion (Sign-up)
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "conversion", {
          send_to: "AW-847619425/TL32CLXkx5IcEOHKlpQD",
        });
      }
      toast({
        title: t("register.success"),
        description: t("register.successDesc"),
      });
      setLocation("/login");
    },
    onError: (error: Error) => {
      toast({
        title: t("register.error"),
        description: error.message || t("register.errorDesc"),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: RegistrationFormData) => {
    registrationMutation.mutate(data);
  };

  return (
    <>
      <Helmet>
        <title>Регистрация | CHIP Technologies B2B</title>
        <meta name="description" content="Зарегистрируйтесь в B2B-портале CHIP Technologies и получите доступ к оптовым ценам на IT-оборудование для вашей компании." />
        <link rel="canonical" href="https://b2b.chip.am/register" />
      </Helmet>
      <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("register.back")}
          </Button>
        </div>
      </div>

      <div className="py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{t("register.title")}</CardTitle>
              <CardDescription>
                {t("register.subtitle")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("register.companyDataTitle")}
                      </h3>

                      <FormField
                        control={form.control}
                        name="companyName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Կազմակերպության անվանում *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="«ՕՐԻՆԱԿ» (ՍՊԸ)"
                                {...field}
                                data-testid="input-company-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="taxId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ՀՎՀՀ *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="01234567"
                                {...field}
                                data-testid="input-tax-id"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="deliveryAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Առաքման հասցե *</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="ք․ Երևան, Կենտրոն, Անհայտ փ․ 99"
                                rows={3}
                                {...field}
                                data-testid="input-delivery-address"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="bankName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Բանկի անվանում *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Բանկ ՓԲԸ"
                                {...field}
                                data-testid="input-bank-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="bankAccount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Հաշվեհամար *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="1575512345610100"
                                {...field}
                                data-testid="input-bank-account"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("register.contactPerson")}
                      </h3>

                      <FormField
                        control={form.control}
                        name="representativeName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("register.representativeName")}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t("register.representativePlaceholder")}
                                {...field}
                                data-testid="input-representative-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email *</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="example@company.am"
                                {...field}
                                data-testid="input-email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("register.phone")}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="+374 XX XXX XXX"
                                {...field}
                                data-testid="input-phone"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="messenger"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("register.messenger")}</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-messenger">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="telegram">Telegram</SelectItem>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                <SelectItem value="viber">Viber</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="messengerContact"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("register.messengerContact")}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="@username или +374XXXXXXXX"
                                {...field}
                                data-testid="input-messenger-contact"
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
                            <FormLabel>{t("register.password")}</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder={t("register.passwordHint")}
                                {...field}
                                data-testid="input-password"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setLocation("/login")}
                      data-testid="button-cancel"
                    >
                      {t("register.cancel")}
                    </Button>
                    <Button
                      type="submit"
                      disabled={registrationMutation.isPending}
                      data-testid="button-submit"
                    >
                      {registrationMutation.isPending ? t("register.submitting") : t("register.submit")}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </>
  );
}
