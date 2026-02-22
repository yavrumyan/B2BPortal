import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Calendar, Trash2, Download, Send, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Order, Product, OrderComment } from "@shared/schema";
import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface OrderWithCustomer extends Order {
  customerName: string;
}

export default function OrderDetail() {
  const [, params] = useRoute("/orders/:id");
  const [, setLocation] = useLocation();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [deliveryDate, setDeliveryDate] = useState<string>("");
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editableItems, setEditableItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const { data: order, isLoading: isLoadingOrder } = useQuery<OrderWithCustomer>({
    queryKey: [`/api/orders/${params?.id}`],
    enabled: !!params?.id,
    refetchOnMount: true,
  });

  const { data: products = [], isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: comments = [], isLoading: isLoadingComments } = useQuery<OrderComment[]>({
    queryKey: [`/api/orders/${params?.id}/comments`],
    enabled: !!params?.id,
    refetchInterval: 10000,
  });

  const isLoading = isLoadingOrder || isLoadingProducts;

  // Update payment status mutation
  const updatePaymentStatusMutation = useMutation({
    mutationFn: async (paymentStatus: string) => {
      const response = await fetch(`/api/orders/${params?.id}/payment-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ paymentStatus }),
      });
      if (!response.ok) throw new Error("Failed to update payment status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${params?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Успешно",
        description: "Статус оплаты обновлен",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статус оплаты",
        variant: "destructive",
      });
    },
  });

  // Update delivery status mutation
  const updateDeliveryStatusMutation = useMutation({
    mutationFn: async (deliveryStatus: string) => {
      const response = await fetch(`/api/orders/${params?.id}/delivery-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ deliveryStatus }),
      });
      if (!response.ok) throw new Error("Failed to update delivery status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${params?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Успешно",
        description: "Статус доставки обновлен",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статус доставки",
        variant: "destructive",
      });
    },
  });

  // Update delivery date mutation
  const updateDeliveryDateMutation = useMutation({
    mutationFn: async (date: string) => {
      const response = await fetch(`/api/orders/${params?.id}/delivery-date`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ deliveryDate: date }),
      });
      if (!response.ok) throw new Error("Failed to update delivery date");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${params?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Успешно",
        description: "Дата доставки обновлена",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить дату доставки",
        variant: "destructive",
      });
    },
  });

  // Update order items mutation
  const updateOrderItemsMutation = useMutation({
    mutationFn: async (items: any[]) => {
      const response = await fetch(`/api/orders/${params?.id}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items }),
      });
      if (!response.ok) throw new Error("Failed to update order items");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${params?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setIsEditingItems(false);
      toast({
        title: "Успешно",
        description: "Товары в заказе обновлены",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить товары",
        variant: "destructive",
      });
    },
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async ({ message, isInternal }: { message: string; isInternal: boolean }) => {
      const response = await fetch(`/api/orders/${params?.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message, isInternal }),
      });
      if (!response.ok) throw new Error("Failed to add comment");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${params?.id}/comments`] });
      setNewComment("");
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось добавить комментарий", variant: "destructive" });
    },
  });

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge variant="default">Оплачен</Badge>;
      case "partially_paid":
        return <Badge variant="secondary">Частично оплачен</Badge>;
      case "not_paid":
        return <Badge variant="destructive">Не оплачен</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getDeliveryStatusBadge = (status: string) => {
    switch (status) {
      case "processing":
        return <Badge variant="outline">Принят</Badge>;
      case "confirmed":
        return <Badge variant="outline">Подтвержден</Badge>;
      case "transit":
        return <Badge variant="secondary">В пути</Badge>;
      case "delivered":
        return <Badge variant="default">Доставлен</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto p-6">
        <p>Заказ не найден</p>
      </div>
    );
  }

  const items = order.items as Array<{ productId: string; name?: string; price: number; quantity: number }>;

  // Get product names from products list for items that don't have names
  const itemsWithNames = items.map(item => {
    // If no name or name is 'Unnamed Product', try to fetch from products
    if (!item.name || item.name === 'Unnamed Product' || item.name.trim() === '') {
      const product = products?.find((p: any) => p.id === item.productId);
      if (product) {
        return {
          ...item,
          name: product.name
        };
      }
    }
    return {
      ...item,
      name: item.name || 'Unnamed Product'
    };
  });

  return (
    <div className="container mx-auto p-6">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => setLocation(isAdmin ? "/admin?section=orders" : "/?section=orders")}
        data-testid="button-back-order"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Назад
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Заказ #{order.orderNumber}</CardTitle>
              <div className="text-sm text-muted-foreground mt-1">
                {new Date(order.createdAt!).toLocaleDateString("ru-RU", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/api/orders/${order.id}/pdf`, "_blank")}
              data-testid="button-download-invoice"
            >
              <Download className="mr-2 h-4 w-4" />
              Накладная PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Информация о клиенте</h3>
              <p className="text-sm text-muted-foreground">{order.customerName}</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Статус</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Оплата:</span>
                  {isAdmin ? (
                    <Select
                      value={order.paymentStatus}
                      onValueChange={(value) => updatePaymentStatusMutation.mutate(value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_paid">Не оплачен</SelectItem>
                        <SelectItem value="partially_paid">Частично оплачен</SelectItem>
                        <SelectItem value="paid">Оплачен</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    getPaymentStatusBadge(order.paymentStatus)
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Доставка:</span>
                  {isAdmin ? (
                    <Select
                      value={order.deliveryStatus}
                      onValueChange={(value) => updateDeliveryStatusMutation.mutate(value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="processing">Принят</SelectItem>
                        <SelectItem value="confirmed">Подтвержден</SelectItem>
                        <SelectItem value="transit">В пути</SelectItem>
                        <SelectItem value="delivered">Доставлен</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    getDeliveryStatusBadge(order.deliveryStatus)
                  )}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Дата доставки</h3>
            {isAdmin ? (
              <div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 max-w-sm">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={deliveryDate || (order.deliveryDate ? new Date(order.deliveryDate).toISOString().slice(0, 10) : "")}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button
                    onClick={() => updateDeliveryDateMutation.mutate(deliveryDate)}
                    disabled={!deliveryDate || updateDeliveryDateMutation.isPending}
                  >
                    Сохранить
                  </Button>
                </div>
                {order.deliveryDate && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Текущая дата: {new Date(order.deliveryDate).toLocaleDateString("ru-RU")}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm">
                {order.deliveryDate 
                  ? new Date(order.deliveryDate).toLocaleDateString("ru-RU", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "Не установлена"}
              </p>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Товары в заказе</h3>
              {isAdmin && !isEditingItems && order && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setEditableItems((order.items as any[]) || []);
                    setIsEditingItems(true);
                  }}
                  data-testid="button-edit-items"
                >
                  Редактировать
                </Button>
              )}
            </div>

            {isAdmin && isEditingItems ? (
              <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
                {/* Editable items list */}
                <div className="space-y-3">
                  {editableItems.map((item: any, index: number) => (
                    <div key={index} className="space-y-2 p-3 border rounded bg-background">
                      <div className="flex gap-2 items-start">
                        <div className="flex-1">
                          <Label className="text-xs">Товар</Label>
                          <p className="text-sm font-medium mt-1">{item.name || products?.find((p: any) => p.id === item.productId)?.name || 'Unknown'}</p>
                        </div>
                        <div className="w-20">
                          <Label className="text-xs">Кол-во</Label>
                          <Input 
                            type="number"
                            value={item.quantity}
                            onChange={(e) => {
                              const newItems = [...editableItems];
                              newItems[index].quantity = parseInt(e.target.value) || 0;
                              setEditableItems(newItems);
                            }}
                            className="mt-1"
                          />
                        </div>
                        <div className="w-24">
                          <Label className="text-xs">Цена ֏</Label>
                          <Input 
                            type="number"
                            value={item.price}
                            onChange={(e) => {
                              const newItems = [...editableItems];
                              newItems[index].price = parseInt(e.target.value) || 0;
                              setEditableItems(newItems);
                            }}
                            className="mt-1"
                          />
                        </div>
                        <Button 
                          variant="destructive"
                          size="sm"
                          className="mt-6"
                          onClick={() => {
                            setEditableItems(editableItems.filter((_: any, i: number) => i !== index));
                          }}
                          data-testid={`button-delete-item-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add product dropdown */}
                <div className="space-y-2">
                  <Label>Добавить товар</Label>
                  <div className="relative">
                    <Input 
                      placeholder="Поиск товара..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      data-testid="input-search-products"
                    />
                    {showDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 border rounded bg-background shadow-lg z-10 max-h-48 overflow-auto">
                        {products
                          ?.filter((p: any) => 
                            p.name.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .sort((a: any, b: any) => a.name.localeCompare(b.name))
                          .map((product: any) => (
                            <div
                              key={product.id}
                              className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                              onClick={() => {
                                setEditableItems([
                                  ...editableItems,
                                  {
                                    productId: product.id,
                                    name: product.name,
                                    price: product.price,
                                    quantity: 1
                                  }
                                ]);
                                setSearchQuery("");
                                setShowDropdown(false);
                              }}
                              data-testid={`product-option-${product.id}`}
                            >
                              {product.name} - {product.price.toLocaleString()} ֏
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Save/Cancel buttons */}
                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setIsEditingItems(false);
                      setEditableItems([]);
                      setSearchQuery("");
                    }}
                    data-testid="button-cancel-edit"
                  >
                    Отмена
                  </Button>
                  <Button 
                    onClick={() => updateOrderItemsMutation.mutate(editableItems)}
                    disabled={updateOrderItemsMutation.isPending}
                    data-testid="button-save-items"
                  >
                    Сохранить
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {itemsWithNames.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Количество: {item.quantity} × {item.price.toLocaleString()} ֏
                      </p>
                    </div>
                    <p className="font-semibold">{(item.price * item.quantity).toLocaleString()} ֏</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <span className="text-lg font-semibold">Итого:</span>
            <span className="text-2xl font-bold">
              {isAdmin && isEditingItems
                ? (editableItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)).toLocaleString()
                : order.total.toLocaleString()} ֏
            </span>
          </div>

          {/* ── Comments Section ── */}
          <div className="pt-4 border-t space-y-4">
            <h3 className="font-semibold">Комментарии</h3>

            {/* Comments list */}
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {isLoadingComments ? (
                <Skeleton className="h-16 w-full" />
              ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Комментариев пока нет</p>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-lg p-3 text-sm ${
                      c.isInternal
                        ? "bg-amber-50 border border-amber-200"
                        : c.authorRole === "admin"
                        ? "bg-blue-50 border border-blue-200 ml-8"
                        : "bg-gray-50 border border-gray-200 mr-8"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-xs">{c.authorName}</span>
                      {c.isInternal && (
                        <span className="flex items-center gap-1 text-amber-700 text-xs">
                          <Lock className="h-3 w-3" /> Внутренняя заметка
                        </span>
                      )}
                      <span className="text-muted-foreground text-xs ml-auto">
                        {new Date(c.createdAt!).toLocaleString("ru-RU", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{c.message}</p>
                  </div>
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* New comment input */}
            <div className="space-y-2">
              <Textarea
                placeholder="Написать комментарий..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
                data-testid="input-comment"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && newComment.trim()) {
                    addCommentMutation.mutate({ message: newComment.trim(), isInternal });
                  }
                }}
              />
              <div className="flex items-center justify-between">
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id="internal-switch"
                      checked={isInternal}
                      onCheckedChange={setIsInternal}
                    />
                    <label htmlFor="internal-switch" className="text-sm text-muted-foreground cursor-pointer">
                      Внутренняя заметка
                    </label>
                  </div>
                )}
                <Button
                  size="sm"
                  className="ml-auto"
                  disabled={!newComment.trim() || addCommentMutation.isPending}
                  onClick={() => addCommentMutation.mutate({ message: newComment.trim(), isInternal })}
                  data-testid="button-send-comment"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Отправить
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}