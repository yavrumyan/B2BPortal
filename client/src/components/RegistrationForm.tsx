import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

// Schema updated to include Armenian field names and placeholders
const registrationSchema = z.object({
  companyName: z.string().min(2, "Название компании должно содержать минимум 2 символа"),
  taxId: z.string().min(8, "ИНН должен содержать минимум 8 символов"),
  deliveryAddress: z.string().min(10, "Адрес доставки должен содержать минимум 10 символов"),
  bankName: z.string().min(2, "Название банка должно содержать минимум 2 символа"),
  bankAccount: z.string().min(10, "Расчетный счет должен содержать минимум 10 символов"),
  representativeName: z.string().min(2, "ФИО должно содержать минимум 2 символа"),
  email: z.string().email("Пожалуйста, введите корректный email"),
  phone: z.string().min(8, "Телефон должен содержать минимум 8 символов"),
  messenger: z.enum(["telegram", "whatsapp", "viber"]),
  messengerContact: z.string().min(3, "Контакт должен содержать минимум 3 символа"),
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

interface RegistrationFormProps {
  onSubmit?: (data: RegistrationFormData) => void;
}

export default function RegistrationForm({ onSubmit }: RegistrationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      companyName: "",
      taxId: "",
      deliveryAddress: "", // Corrected field name
      bankName: "",
      bankAccount: "", // Corrected field name
      representativeName: "",
      email: "",
      phone: "",
      messenger: "telegram",
      messengerContact: "",
    },
  });

  const handleSubmit = async (data: RegistrationFormData) => {
    setIsSubmitting(true);
    console.log("Registration data:", data);
    onSubmit?.(data);
    setTimeout(() => setIsSubmitting(false), 1000);
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Регистрация корпоративного клиента</CardTitle>
          <CardDescription>
            Заполните форму для регистрации. Ваша заявка будет рассмотрена администратором.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    ДАННЫЕ КОМПАНИИ (на армянском)
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
                            className="resize-none"
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
                    КОНТАКТНОЕ ЛИЦО
                  </h3>

                  <FormField
                    control={form.control}
                    name="representativeName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ФИО представителя *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Иванов Иван Иванович"
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
                            placeholder="ivan@example.com"
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
                        <FormLabel>Телефон *</FormLabel>
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
                        <FormLabel>Мессенджер *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-messenger">
                              <SelectValue placeholder="Выберите мессенджер" />
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
                        <FormLabel>Контакт в мессенджере *</FormLabel>
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
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting}
                data-testid="button-submit-registration"
              >
                {isSubmitting ? "Отправка..." : "Отправить заявку"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}