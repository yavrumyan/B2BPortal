import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import ProductListTable from "@/components/ProductListTable";
import CartSidebar, { type CartItem } from "@/components/CartSidebar";
import CustomerSidebar from "@/components/CustomerSidebar";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { apiRequest } from "@/lib/queryClient";
import type { Product, Order, Customer, Settings } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, X, ShoppingCart, ImagePlus, Menu, Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const categories = [
  "Ноутбуки", "Компьютеры", "Серверы", "Телефоны", "Планшеты",
  "Компоненты ПК", "Мониторы", "Принтеры/Сканеры", "Проекторы и экраны",
  "ИБП (UPS)", "Аксессуары", "Программное обеспечение", "Сетевое оборудование",
  "Кабели/Переходники", "Гаджеты", "ТВ/Аудио/Видео техника", "Фото/Видео техника",
  "Торговое оборудование", "Системы безопасности",
];

function CustomerInquiriesSection({ 
  onAddToCart, 
  cartItems 
}: { 
  onAddToCart?: (item: CartItem) => void;
  cartItems?: CartItem[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(true);
  const [formData, setFormData] = useState({
    productsRequested: [{ category: "", description: "", quantity: 1, image: null as File | null }],
    deadline: "",
  });

  const { data: inquiries = [] } = useQuery<any[]>({
    queryKey: ["/api/inquiries"],
  });

  const createInquiryMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/inquiries", data);
    },
    onSuccess: () => {
      toast({ title: "Запрос отправлен успешно!" });
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      setShowForm(true);
      setFormData({
        productsRequested: [{ category: "", description: "", quantity: 1, image: null }],
        deadline: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отправить запрос",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Отправлено": return "bg-yellow-100 text-yellow-800";
      case "Получено предложение": return "bg-blue-100 text-blue-800";
      case "Заказано": return "bg-green-100 text-green-800";
      case "Нет предложения": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (let product of formData.productsRequested) {
      if (!product.description) {
        toast({
          title: "Ошибка",
          description: "Пожалуйста, заполните описание для каждого товара",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Convert images to base64
    const productsWithImages = await Promise.all(
      formData.productsRequested.map(async (product) => {
        let imageData = undefined;
        if (product.image) {
          imageData = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(product.image as File);
          });
        }
        return {
          category: product.category,
          description: product.description,
          quantity: product.quantity,
          image: imageData
        };
      })
    );
    
    createInquiryMutation.mutate({
      ...formData,
      productsRequested: productsWithImages
    });
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-3xl font-bold">Мои запросы</h1>
      
      {showForm && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Отправить новый запрос</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <label className="text-sm font-medium">Товары</label>
              {formData.productsRequested.map((product, idx) => (
                <div key={idx} className="space-y-2 border p-3 rounded">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="text-sm font-medium">Категория товара (не обязательно)</label>
                      <select 
                        value={product.category} 
                        onChange={(e) => {
                          const newProducts = [...formData.productsRequested];
                          newProducts[idx].category = e.target.value;
                          setFormData({...formData, productsRequested: newProducts});
                        }}
                        className="border rounded-md px-3 py-2 w-full text-sm"
                      >
                        <option value="">Выберите категорию...</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e: any) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const newProducts = [...formData.productsRequested];
                              newProducts[idx].image = file;
                              setFormData({...formData, productsRequested: newProducts});
                            }
                          };
                          input.click();
                        }}
                        className={`whitespace-nowrap ${product.image ? 'border-green-500 text-green-700 hover:border-green-600' : ''}`}
                        data-testid={`button-upload-image-${idx}`}
                      >
                        {product.image
                          ? <Check className="h-4 w-4 mr-2" />
                          : <ImagePlus className="h-4 w-4 mr-2" />
                        }
                        Фото
                      </Button>
                      {product.image && (
                        <div className="flex items-center gap-1 text-xs text-green-700 max-w-[120px]">
                          <span className="truncate">{product.image.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const newProducts = [...formData.productsRequested];
                              newProducts[idx].image = null;
                              setFormData({...formData, productsRequested: newProducts});
                            }}
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            data-testid={`button-remove-image-${idx}`}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                    {formData.productsRequested.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const newProducts = formData.productsRequested.filter((_, i) => i !== idx);
                          setFormData({...formData, productsRequested: newProducts});
                        }}
                      >
                        <X size={18} />
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Textarea
                      value={product.description}
                      onChange={(e) => {
                        const newProducts = [...formData.productsRequested];
                        newProducts[idx].description = e.target.value;
                        setFormData({...formData, productsRequested: newProducts});
                      }}
                      placeholder="Описание товара* /обязательно/"
                      className="text-sm flex-1"
                      rows={3}
                    />
                    <div className="flex flex-col justify-between">
                      <label className="text-sm font-medium">Кол-во</label>
                      <Input
                        type="number"
                        value={product.quantity}
                        onChange={(e) => {
                          const newProducts = [...formData.productsRequested];
                          newProducts[idx].quantity = Number(e.target.value);
                          setFormData({...formData, productsRequested: newProducts});
                        }}
                        placeholder="Количество"
                        className="w-20 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setFormData({
                  ...formData, 
                  productsRequested: [...formData.productsRequested, {category: "", description: "", quantity: 1, image: null}]
                })}
                className="text-sm"
              >
                + Добавить товар
              </Button>
            </div>

            <div>
              <label className="text-sm font-medium">Срок ответа (опционально)</label>
              <Input 
                type="date" 
                value={formData.deadline}
                onChange={(e) => setFormData({...formData, deadline: e.target.value})}
                className="text-sm"
              />
            </div>

            <Button type="submit" disabled={createInquiryMutation.isPending} className="w-full bg-blue-600 hover:bg-blue-700">
              Отправить запрос
            </Button>
          </form>
        </Card>
      )}
      
      <Button variant="outline" onClick={() => setShowForm(!showForm)} className="text-sm">
        {showForm ? "Скрыть форму" : "Показать форму"}
      </Button>

      <div className="space-y-2">
        {inquiries.length === 0 ? (
          <Card className="p-4 text-center text-gray-500 text-sm">Нет запросов</Card>
        ) : (
          inquiries.map((inquiry: any) => (
            <Card key={inquiry.id} className="p-0 overflow-hidden cursor-default hover:shadow-sm transition-shadow">
              <div 
                className="p-3 cursor-pointer hover:bg-muted/50 transition-colors flex justify-between items-center"
                onClick={async () => {
                  if (!inquiry.seen) {
                    try {
                      await apiRequest("PATCH", `/api/inquiries/${inquiry.id}/seen`, {});
                      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
                    } catch (error) {
                      console.error("Error marking inquiry as seen:", error);
                    }
                  }
                  setExpandedId(expandedId === inquiry.id ? null : inquiry.id);
                }}
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(inquiry.status)}`}>{inquiry.status}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(inquiry.createdAt).toLocaleDateString("ru-RU")}
                  </span>
                </div>
                {expandedId === inquiry.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
              {expandedId === inquiry.id && (
                <div className="p-3 pt-0 space-y-3 text-sm">
                  <div className="border-t pt-3">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Запрашиваемые товары:</p>
                    <div className="space-y-2">
                      {inquiry.productsRequested?.map((product: any, idx: number) => (
                        <div key={idx} className="border rounded p-2 bg-gray-50">
                          <div className="font-medium text-xs text-gray-700">{product.category}</div>
                          <div className="text-xs text-gray-600 mt-1">{product.description}</div>
                          <div className="text-xs text-gray-500 mt-1">Кол-во: {product.quantity}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {inquiry.deadline && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600">Срок ответа:</p>
                      <p className="text-xs text-gray-600">{new Date(inquiry.deadline).toLocaleDateString("ru-RU")}</p>
                    </div>
                  )}

                  {inquiry.offers && inquiry.offers.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-xs mb-2">Полученные предложения:</h4>
                      <div className="space-y-2">
                        {inquiry.offers.map((offer: any) => (
                          <Card key={offer.id} className="p-2 bg-blue-50 border-blue-200">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1">
                                <div className="text-xs font-medium">{offer.productName}</div>
                                <div className="text-xs text-gray-600 mt-1">Цена: {offer.price} AMD {offer.quantity && `(Кол-во: ${offer.quantity})`}</div>
                                <div className="text-xs text-gray-600">Доставка: {offer.deliveryTime}</div>
                                {offer.comment && (
                                  <div className="text-xs text-gray-600 mt-1">Комментарий: {offer.comment}</div>
                                )}
                              </div>
                              <Button
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onAddToCart) {
                                    onAddToCart({
                                      id: offer.productId || `offer-${offer.id}`,
                                      name: offer.productName,
                                      quantity: offer.quantity || 1,
                                      price: offer.price,
                                    });
                                    toast({ title: "Товар добавлен в корзину" });
                                  }
                                }}
                                className="bg-green-600 hover:bg-green-700"
                                data-testid={`button-add-offer-${offer.id}`}
                              >
                                <ShoppingCart className="h-4 w-4" />
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [activeSection, setActiveSection] = useState<"products" | "orders" | "inquiries" | "profile">(() => {
    // Parse section from URL query parameter
    const params = new URLSearchParams(window.location.search);
    const section = params.get("section");
    if (section === "products" || section === "orders" || section === "inquiries" || section === "profile") {
      return section;
    }
    return "products";
  });
  const { isAuthenticated, isAdmin, customer } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [profileData, setProfileData] = useState({
    companyName: "",
    taxId: "",
    deliveryAddress: "",
    bankName: "",
    bankAccount: "",
    representativeName: "",
    email: "",
    phone: "",
    messenger: "telegram" as "telegram" | "whatsapp" | "viber",
    messengerContact: "",
  });
  const [profileEdited, setProfileEdited] = useState(false);
  // State to keep track of quantities for each product in the cart
  const [quantities, setQuantities] = useState<{ [productId: string]: number }>({});
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [deliveryTimeFilter, setDeliveryTimeFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [brandFilter, setBrandFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const { play: playNotificationSound } = useNotificationSound();
  const prevCountsRef = useRef({ orders: 0, inquiries: 0 });

  const CATEGORIES = [
    "Ноутбуки",
    "Компьютеры",
    "Серверы",
    "Телефоны",
    "Планшеты",
    "Компоненты ПК",
    "Мониторы",
    "Принтеры/Сканеры",
    "Проекторы и экраны",
    "ИБП (UPS)",
    "Аксессуары",
    "Программное обеспечение",
    "Сетевое оборудование",
    "Кабели/Переходники",
    "Гаджеты",
    "ТВ/Аудио/Видео техника",
    "Фото/Видео техника",
    "Торговое оборудование",
    "Системы безопасности",
  ];

  // Fetch cart from backend when authenticated
  const { data: backendCart } = useQuery<CartItem[]>({
    queryKey: ["/api/cart"],
    enabled: isAuthenticated,
    staleTime: 0,
  });

  // Sync backend cart to local state on load
  useEffect(() => {
    if (backendCart && isAuthenticated) {
      setCartItems(backendCart);
    }
  }, [backendCart, isAuthenticated]);

  const handleSectionChange = (section: "products" | "orders" | "inquiries" | "profile") => {
    setActiveSection(section);
    setLocation(`/?section=${section}`);
    // Invalidate queries when switching sections to ensure fresh data
    if (section === "products") {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    } else if (section === "orders") {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    } else if (section === "inquiries") {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
    } else if (section === "profile" && customer?.id) {
      // Force refetch stats when viewing profile
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "stats"] });
      queryClient.refetchQueries({ queryKey: ["/api/customers", customer.id, "stats"] });
    }
  };

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const filteredProductIds = useMemo(() => {
    return products.filter((product) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!product.name.toLowerCase().includes(query) &&
            !(product.sku && product.sku.toLowerCase().includes(query))) return false;
      }
      const min = minPrice ? parseInt(minPrice) : 0;
      const max = maxPrice ? parseInt(maxPrice) : Infinity;
      if (product.price < min || product.price > max) return false;
      if (statusFilter && product.stock !== statusFilter) return false;
      if (deliveryTimeFilter && product.eta !== deliveryTimeFilter) return false;
      if (brandFilter && product.brand !== brandFilter) return false;
      if (categoryFilter && product.category !== categoryFilter) return false;
      return true;
    }).map((p) => p.id);
  }, [products, searchQuery, minPrice, maxPrice, statusFilter, deliveryTimeFilter, brandFilter, categoryFilter]);

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: isAuthenticated && !isAdmin,
    refetchInterval: 3000,
  });

  const { data: inquiries = [] } = useQuery<any[]>({
    queryKey: ["/api/inquiries"],
    enabled: isAuthenticated && !isAdmin,
    refetchInterval: 3000,
  });

  interface CustomerWithStats extends Omit<Customer, 'password'> {
    totalOrders?: number;
    totalAmount?: number;
    overdueAmount?: number;
  }

  const { data: customers = [], isLoading: customersLoading } = useQuery<CustomerWithStats[]>({
    queryKey: ["/api/customers"],
    enabled: isAdmin,
  });

  // Fetch customer stats for non-admin users
  const { data: customerStats } = useQuery<{
    orderCount: number;
    totalOrderAmount: number;
    overduePayments: number;
  }>({
    queryKey: ["/api/customers", customer?.id, "stats"],
    queryFn: async () => {
      if (!customer?.id) throw new Error("No customer ID");
      const response = await apiRequest("GET", `/api/customers/${customer.id}/stats`);
      return await response.json();
    },
    enabled: isAuthenticated && !isAdmin && !!customer?.id && activeSection === "profile",
  });

  // Play sound when new orders or inquiries arrive
  useEffect(() => {
    const orderCount = orders.filter(o => !o.seen).length;
    const inquiryCount = inquiries.filter(i => !i.seen).length;
    
    if (prevCountsRef.current.orders > 0 && orderCount > prevCountsRef.current.orders) {
      playNotificationSound();
    }
    if (prevCountsRef.current.inquiries > 0 && inquiryCount > prevCountsRef.current.inquiries) {
      playNotificationSound();
    }
    prevCountsRef.current = { orders: orderCount, inquiries: inquiryCount };
  }, [orders, inquiries, playNotificationSound]);

  // Sync profile data with customer when customer changes
  useEffect(() => {
    if (customer) {
      setProfileData({
        companyName: customer.companyName,
        taxId: customer.taxId,
        deliveryAddress: customer.deliveryAddress,
        bankName: customer.bankName,
        bankAccount: customer.bankAccount,
        representativeName: customer.representativeName,
        email: customer.email,
        phone: customer.phone,
        messenger: customer.messenger as "telegram" | "whatsapp" | "viber",
        messengerContact: customer.messengerContact,
      });
    }
  }, [customer]);

  // Track if profile has been edited
  useEffect(() => {
    if (customer) {
      const hasChanged = 
        profileData.companyName !== customer.companyName ||
        profileData.taxId !== customer.taxId ||
        profileData.deliveryAddress !== customer.deliveryAddress ||
        profileData.bankName !== customer.bankName ||
        profileData.bankAccount !== customer.bankAccount ||
        profileData.representativeName !== customer.representativeName ||
        profileData.phone !== customer.phone ||
        profileData.messenger !== customer.messenger ||
        profileData.messengerContact !== customer.messengerContact;
      setProfileEdited(hasChanged);
    }
  }, [customer, profileData]);

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<Customer>) => {
      if (!customer?.id) throw new Error("No customer ID");
      return await apiRequest("PATCH", `/api/customers/${customer.id}`, updates);
    },
    onSuccess: () => {
      toast({
        title: "Данные обновлены",
        description: "Ваши данные успешно сохранены",
      });
      setProfileEdited(false);
      // Refresh customer data without full page reload
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer?.id, "stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить данные",
        variant: "destructive",
      });
    },
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({
      companyName: profileData.companyName,
      taxId: profileData.taxId,
      deliveryAddress: profileData.deliveryAddress,
      bankName: profileData.bankName,
      bankAccount: profileData.bankAccount,
      representativeName: profileData.representativeName,
      phone: profileData.phone,
      messenger: profileData.messenger,
      messengerContact: profileData.messengerContact,
    });
  };

  const handleAddToCart = async (productId: string, quantity: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const existingItem = cartItems.find((item) => item.id === productId);

    let newCart: CartItem[];
    if (existingItem) {
      newCart = cartItems.map((item) =>
        item.id === productId
          ? { ...item, quantity: item.quantity + quantity }
          : item
      );
    } else {
      newCart = [
        ...cartItems,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity,
          image: product.imageUrl || undefined,
          moq: product.moq || 0,
          stock: product.availableQuantity,
        },
      ];
    }

    setCartItems(newCart);

    // Sync to backend if authenticated
    if (isAuthenticated) {
      try {
        await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cart: newCart }),
          credentials: "include",
        });
      } catch (error) {
        console.error("Failed to sync cart:", error);
      }
    }

    setIsCartOpen(true);
    toast({
      title: "Добавлено в корзину",
      description: `${product.name} (${quantity} шт.)`,
    });
  };

  const handleUpdateQuantity = async (itemId: string, quantity: number) => {
    const newCart = cartItems.map((item) =>
      item.id === itemId ? { ...item, quantity } : item
    );
    setCartItems(newCart);

    // Sync to backend if authenticated
    if (isAuthenticated) {
      try {
        await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cart: newCart }),
          credentials: "include",
        });
      } catch (error) {
        console.error("Failed to sync cart:", error);
      }
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    const newCart = cartItems.filter((item) => item.id !== itemId);
    setCartItems(newCart);

    // Sync to backend if authenticated
    if (isAuthenticated) {
      try {
        await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cart: newCart }),
          credentials: "include",
        });
      } catch (error) {
        console.error("Failed to sync cart:", error);
      }
    }
  };

  const checkoutMutation = useMutation({
    mutationFn: async (orderData: { items: Array<{ productId: string; quantity: number; price: number; name?: string }>; total: number }) => {
      return await apiRequest("POST", "/api/orders", orderData);
    },
    onSuccess: async () => {
      setCartItems([]);
      setIsCartOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      if (customer?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "stats"] });
      }
      toast({
        title: "Заказ оформлен",
        description: "Ваш заказ успешно отправлен. Мы свяжемся с вами в ближайшее время.",
      });

      // Clear cart from backend
      if (isAuthenticated) {
        try {
          await fetch("/api/cart", {
            method: "DELETE",
            credentials: "include",
          });
        } catch (error) {
          console.error("Failed to clear cart:", error);
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось оформить заказ",
        variant: "destructive",
      });
    },
  });

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      setIsCartOpen(false);
      toast({
        title: "Требуется авторизация",
        description: "Пожалуйста, войдите в систему для оформления заказа",
        variant: "destructive",
      });
      setLocation("/login");
    } else {
      const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const orderData = {
        items: cartItems.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          price: item.price,
          name: item.name,
        })),
        total,
      };
      checkoutMutation.mutate(orderData);
    }
  };

  // Redirect admin users to admin panel
  if (isAdmin) {
    setLocation("/admin");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        cartItemCount={cartItems.reduce((sum, item) => sum + item.quantity, 0)}
        onCartClick={() => setIsCartOpen(true)}
        onMenuClick={isAuthenticated && !isAdmin ? () => setIsSidebarOpen(true) : undefined}
      />

      <div className="flex">
        {isAuthenticated && !isAdmin && (
          <CustomerSidebar
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
            orderCount={orders.filter(o => !o.seen).length}
            inquiryCount={inquiries.filter(i => !i.seen).length}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />
        )}

        <main className="flex-1 px-4 py-6 max-w-full overflow-x-hidden">
          {isAuthenticated && !isAdmin && activeSection === "orders" && (
            <div className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">Мои заказы</h2>
              {ordersLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <p className="text-muted-foreground">У вас пока нет заказов</p>
              ) : (
                <div className="grid gap-4">
                  {orders.map((order) => (
                    <Card
                      key={order.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={async () => {
                        if (!order.seen) {
                          try {
                            await apiRequest("PATCH", `/api/orders/${order.id}/seen`, {});
                            queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
                          } catch (error) {
                            console.error("Error marking order as seen:", error);
                          }
                        }
                        setLocation(`/orders/${order.id}`);
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium">Заказ #{order.orderNumber}</div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(order.createdAt!).toLocaleDateString("ru-RU")}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {(() => {
                                const items = order.items as Array<{ productId: string; name?: string; quantity: number }>;
                                return items.map(item => {
                                  const product = products?.find((p: any) => p.id === item.productId);
                                  const productName = item.name && item.name !== 'Unnamed Product' ? item.name : (product?.name || 'Unnamed Product');
                                  return `${productName} (${item.quantity})`;
                                }).join(', ');
                              })()}
                            </div>
                            <div className="flex gap-2 mt-2">
                              <Badge 
                                variant={order.paymentStatus === "paid" ? "default" : order.paymentStatus === "partially_paid" ? "secondary" : "destructive"}
                                className={order.paymentStatus === "paid" ? "bg-green-600 text-white" : order.paymentStatus === "partially_paid" ? "bg-blue-600 text-white" : "bg-red-600 text-white"}
                              >
                                {order.paymentStatus === "paid" ? "Оплачен" : order.paymentStatus === "partially_paid" ? "Частично оплачен" : "Не оплачен"}
                              </Badge>
                              <Badge 
                                variant={order.deliveryStatus === "delivered" ? "default" : order.deliveryStatus === "transit" ? "secondary" : "outline"}
                                className={order.deliveryStatus === "delivered" ? "bg-green-600 text-white" : order.deliveryStatus === "transit" ? "bg-orange-500 text-white" : order.deliveryStatus === "confirmed" ? "bg-blue-600 text-white" : "bg-gray-700 text-white"}
                              >
                                {order.deliveryStatus === "delivered" ? "Доставлен" : order.deliveryStatus === "transit" ? "В пути" : order.deliveryStatus === "confirmed" ? "Подтвержден" : "Принят"}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-lg font-semibold">
                            {order.total.toLocaleString()} ֏
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {isAuthenticated && !isAdmin && activeSection === "profile" && customer && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Мои данные</h2>
                {profileEdited && (
                  <Button onClick={handleSaveProfile} variant="default">
                    Сохранить изменения
                  </Button>
                )}
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Информация о компании</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-40">Название компании:</span>
                      <Input
                        value={profileData.companyName}
                        onChange={(e) => setProfileData({ ...profileData, companyName: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-40">ИНН:</span>
                      <Input
                        value={profileData.taxId}
                        onChange={(e) => setProfileData({ ...profileData, taxId: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-40">Адрес доставки:</span>
                      <Input
                        value={profileData.deliveryAddress}
                        onChange={(e) => setProfileData({ ...profileData, deliveryAddress: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-40">Банк:</span>
                      <Input
                        value={profileData.bankName}
                        onChange={(e) => setProfileData({ ...profileData, bankName: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-40">Банковский счет:</span>
                      <Input
                        value={profileData.bankAccount}
                        onChange={(e) => setProfileData({ ...profileData, bankAccount: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Контактная информация</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-40">Представитель:</span>
                      <Input
                        value={profileData.representativeName}
                        onChange={(e) => setProfileData({ ...profileData, representativeName: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-40">Email:</span>
                      <Input
                        value={profileData.email}
                        disabled
                        className="flex-1 bg-muted"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-40">Телефон:</span>
                      <Input
                        value={profileData.phone}
                        onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-40">Мессенджер:</span>
                      <Select
                        value={profileData.messenger}
                        onValueChange={(value) => setProfileData({ ...profileData, messenger: value as "telegram" | "whatsapp" | "viber" })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="telegram">Telegram</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="viber">Viber</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-40">Контакт в мессенджере:</span>
                      <Input
                        value={profileData.messengerContact}
                        onChange={(e) => setProfileData({ ...profileData, messengerContact: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-40">Статус:</span>
                      <Badge variant={customer.status === "approved" ? "default" : "secondary"}>
                        {customer.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Статистика заказов</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Количество заказов:</span>
                      <span className="font-medium">{customerStats?.orderCount ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Сумма всех заказов:</span>
                      <span className="font-medium">{(customerStats?.totalOrderAmount ?? 0).toLocaleString()} ֏</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Просроченные платежи:</span>
                      <span className="font-medium text-destructive">{(customerStats?.overduePayments ?? 0).toLocaleString()} ֏</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {isAuthenticated && !isAdmin && activeSection === "inquiries" && (
            <CustomerInquiriesSection 
              onAddToCart={(item) => setCartItems([...cartItems, item])}
              cartItems={cartItems}
            />
          )}

          {(!isAuthenticated || activeSection === "products") && (
            <>
              <div className="mb-6 flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold">Каталог товаров</h1>
                <span className="text-sm text-muted-foreground">Цены включают НДС</span>
                {isAuthenticated && !isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    onClick={() => {
                      const url = filteredProductIds.length < products.length
                        ? `/api/price-list/pdf?ids=${filteredProductIds.join(',')}`
                        : '/api/price-list/pdf';
                      window.open(url, "_blank");
                    }}
                    data-testid="button-download-price-list"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Прайс-лист PDF
                  </Button>
                )}
              </div>

              {/* Filters */}
              <Card className="mb-6">
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-4 items-end">
                    {/* Price Range Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Цена (мин)</label>
                      <Input
                        type="number"
                        placeholder="От"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        data-testid="input-filter-min-price"
                        className="w-full sm:w-32"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Цена (макс)</label>
                      <Input
                        type="number"
                        placeholder="До"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        data-testid="input-filter-max-price"
                        className="w-full sm:w-32"
                      />
                    </div>

                    {/* Status Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Статус</label>
                      <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
                        <SelectTrigger data-testid="select-filter-status" className="w-full sm:w-40">
                          <SelectValue placeholder="Все статусы" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Все статусы</SelectItem>
                          <SelectItem value="in_stock">В наличии</SelectItem>
                          <SelectItem value="low_stock">Мало</SelectItem>
                          <SelectItem value="out_of_stock">Нет в наличии</SelectItem>
                          <SelectItem value="on_order">Под заказ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Delivery Time Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Срок доставки</label>
                      <Select value={deliveryTimeFilter || "all"} onValueChange={(value) => setDeliveryTimeFilter(value === "all" ? "" : value)}>
                        <SelectTrigger data-testid="select-filter-delivery-time" className="w-full sm:w-40">
                          <SelectValue placeholder="Все сроки" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Все сроки</SelectItem>
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
                    </div>

                    {/* Brand Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Бренд</label>
                      <Select value={brandFilter || "all"} onValueChange={(value) => setBrandFilter(value === "all" ? "" : value)}>
                        <SelectTrigger data-testid="select-filter-brand" className="w-full sm:w-40">
                          <SelectValue placeholder="Все бренды" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Все бренды</SelectItem>
                          {Array.from(new Set(products.filter(p => p.brand && typeof p.brand === 'string').map(p => p.brand as string)))
                            .sort()
                            .map((brand) => (
                              <SelectItem key={brand} value={brand}>
                                {brand}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Category Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Категория</label>
                      <Select value={categoryFilter || "all"} onValueChange={(value) => setCategoryFilter(value === "all" ? "" : value)}>
                        <SelectTrigger data-testid="select-filter-category" className="w-full sm:w-40">
                          <SelectValue placeholder="Все категории" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Все категории</SelectItem>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Clear All Filters Button */}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setMinPrice("");
                        setMaxPrice("");
                        setStatusFilter("");
                        setDeliveryTimeFilter("");
                        setBrandFilter("");
                        setCategoryFilter("");
                      }}
                      data-testid="button-clear-filters"
                      className="bg-black hover:bg-black/80 text-white self-end"
                      title="Очистить все фильтры"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Search Bar */}
                  <div>
                    <Input
                      type="text"
                      placeholder="Поиск по названию, артикулу..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-search-products"
                      className="w-full"
                    />
                  </div>
                </CardContent>
              </Card>

              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-4 border-b pb-4">
                      <Skeleton className="h-16 w-16 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                      <Skeleton className="h-9 w-24" />
                    </div>
                  ))}
                </div>
              ) : (() => {
                const filteredProducts = products.filter((product) => {
                  // Search filter
                  if (searchQuery) {
                    const query = searchQuery.toLowerCase();
                    const matchesName = product.name.toLowerCase().includes(query);
                    const matchesSku = product.sku ? product.sku.toLowerCase().includes(query) : false;
                    if (!matchesName && !matchesSku) return false;
                  }

                  // Price filter
                  const min = minPrice ? parseInt(minPrice) : 0;
                  const max = maxPrice ? parseInt(maxPrice) : Infinity;
                  if (product.price < min || product.price > max) return false;

                  // Status filter
                  if (statusFilter && product.stock !== statusFilter) return false;

                  // Delivery time filter
                  if (deliveryTimeFilter && product.eta !== deliveryTimeFilter) return false;

                  // Brand filter
                  if (brandFilter && product.brand !== brandFilter) return false;

                  // Category filter
                  if (categoryFilter && product.category !== categoryFilter) return false;

                  return true;
                });

                return (
                  <>
                    {filteredProducts.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Товары не найдены по выбранным фильтрам
                      </div>
                    ) : (
                      <ProductListTable 
                        products={filteredProducts} 
                        onAddToCart={handleAddToCart} 
                        customerType={customer?.customerType || "корпоративный"}
                        corporateMarkupPercentage={settings?.corporateMarkupPercentage}
                        governmentMarkupPercentage={settings?.governmentMarkupPercentage}
                      />
                    )}
                  </>
                );
              })()}
            </>
          )}
        </main>
      </div>

      <CartSidebar
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onCheckout={handleCheckout}
      />
    </div>
  );
}