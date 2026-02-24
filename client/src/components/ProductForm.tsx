import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const productSchema = z.object({
  name: z.string().min(2, "Введите название товара"),
  sku: z.string().min(1, "Введите артикул"),
  brand: z.string().optional(),
  price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Введите корректную цену",
  }),
  availableQuantity: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: "Введите корректное количество",
  }),
  stock: z.enum(["in_stock", "low_stock", "out_of_stock", "on_order"]),
  moq: z.string().optional(),
  eta: z.string().optional(),
  description: z.string().optional(),
  visibleCustomerTypes: z.array(z.string()).optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormProps {
  onSubmit?: (data: ProductFormData) => void;
  onCancel?: () => void;
}

export default function ProductForm({ onSubmit, onCancel }: ProductFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const customerTypes = ["дилер", "корпоративный", "гос. учреждение"];

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      brand: "",
      price: "",
      availableQuantity: "",
      moq: "",
      stock: "in_stock",
      eta: "1-2 дня",
      description: "",
      visibleCustomerTypes: [],
    },
  });

  const handleSubmit = async (data: ProductFormData) => {
    setIsSubmitting(true);
    // Convert string fields to numbers for API
    const productData = {
      ...data,
      price: Number(data.price),
      availableQuantity: Number(data.availableQuantity),
      moq: data.moq ? Number(data.moq) : undefined,
      visibleCustomerTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
    };
    console.log("Product data:", productData);
    onSubmit?.(productData as any);
    setTimeout(() => {
      setIsSubmitting(false);
      form.reset();
      setSelectedTypes([]);
    }, 1000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Добавить товар</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Например: Ноутбук HP Pavilion 15"
                      {...field}
                      data-testid="input-product-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Артикул *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="HP-PAV-15-001"
                        {...field}
                        data-testid="input-product-sku"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Бренд</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="HP"
                        {...field}
                        data-testid="input-product-brand"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Цена (֏) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="450000"
                        {...field}
                        data-testid="input-product-price"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="availableQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Доступное количество *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="10"
                        {...field}
                        data-testid="input-product-available-quantity"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="moq"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>МОК (минимальный объём заказа)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="1"
                      {...field}
                      data-testid="input-product-moq"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Статус *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-product-stock">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="in_stock">В наличии</SelectItem>
                        <SelectItem value="low_stock">Мало</SelectItem>
                        <SelectItem value="out_of_stock">Нет в наличии</SelectItem>
                        <SelectItem value="on_order">Под заказ</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="eta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Срок доставки</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-product-eta">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1-2 дня">1-2 дня</SelectItem>
                        <SelectItem value="3-7 дней">3-7 дней</SelectItem>
                        <SelectItem value="7-14 дней">7-14 дней</SelectItem>
                        <SelectItem value="14-21 дней">14-21 дней</SelectItem>
                        <SelectItem value="22-35 дней">22-35 дней</SelectItem>
                        <SelectItem value="30-45 дней">30-45 дней</SelectItem>
                        <SelectItem value="40-60 дней">40-60 дней</SelectItem>
                        <SelectItem value="65-90 дней">65-90 дней</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Дополнительная информация о товаре"
                      className="resize-none"
                      {...field}
                      data-testid="input-product-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Видимость для типов клиентов (пусто = видимо всем)</FormLabel>
              <div className="space-y-2">
                {customerTypes.map(type => (
                  <div key={type} className="flex items-center gap-2">
                    <Checkbox
                      id={`type-${type}`}
                      checked={selectedTypes.includes(type)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedTypes([...selectedTypes, type]);
                        } else {
                          setSelectedTypes(selectedTypes.filter(t => t !== type));
                        }
                      }}
                      data-testid={`checkbox-visibility-${type}`}
                    />
                    <label htmlFor={`type-${type}`} className="text-sm cursor-pointer capitalize">
                      {type}
                    </label>
                  </div>
                ))}
              </div>
            </FormItem>

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="button-submit-product"
              >
                {isSubmitting ? "Сохранение..." : "Сохранить"}
              </Button>
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  data-testid="button-cancel-product"
                >
                  Отмена
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
