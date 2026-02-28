import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AdminSidebar from "@/components/AdminSidebar";
import ProductForm from "@/components/ProductForm";
import RegistrationList from "@/components/RegistrationList";
import ProductListTable from "@/components/ProductListTable";
import SettingsPanel from "@/components/SettingsPanel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Trash2, Download, Upload, X, Menu, TrendingUp, TrendingDown, ShoppingBag, Users, AlertCircle, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BusinessRegistration, Product, Order, InsertProduct, Customer, Settings } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportProductsToCSV, importProductsFromCSV } from "@/lib/csvUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from "recharts";

export default function Admin() {
  const [location] = useLocation();
  const [activeSection, setActiveSection] = useState<
    "dashboard" | "products" | "registrations" | "orders" | "inquiries" | "settings"
  >(() => {
    // Parse section from URL query parameter
    const params = new URLSearchParams(window.location.search);
    const section = params.get("section");
    if (section === "dashboard" || section === "products" || section === "registrations" || section === "orders" || section === "inquiries" || section === "settings") {
      return section;
    }
    return "dashboard";
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [debtFilter, setDebtFilter] = useState<string>("all");
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { play: playNotificationSound } = useNotificationSound();
  const prevCountsRef = useRef({ orders: 0, inquiries: 0 });

  const handleSectionChange = (section: "dashboard" | "products" | "registrations" | "orders" | "inquiries" | "settings") => {
    setActiveSection(section);
    setLocation(`/admin?section=${section}`);
    // Invalidate queries when switching sections to ensure fresh data
    if (section === "dashboard") {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
    } else if (section === "products") {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    } else if (section === "registrations") {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    } else if (section === "orders") {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    } else if (section === "inquiries") {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
    }
  };

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast({
        title: "Доступ запрещен",
        description: "У вас нет прав администратора",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [isAdmin, authLoading, setLocation, toast]);

  // Fetch customers (includes both pending and approved)
  const { data: customers = [], isLoading: customersLoading } = useQuery<Omit<Customer, 'password'>[]>({
    queryKey: ["/api/customers"],
    enabled: isAdmin,
  });

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: isAdmin,
  });

  // Fetch orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: isAdmin,
    refetchInterval: 3000,
  });

  // Fetch settings
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
    enabled: isAdmin,
  });

  // Fetch analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: ["/api/analytics"],
    enabled: isAdmin,
    refetchInterval: 60000, // refresh every minute
  });

  const pendingCount = customers.filter((c) => c.status === "pending").length;

  // Fetch inquiries
  const { data: inquiries = [], isLoading: inquiriesLoading } = useQuery<any[]>({
    queryKey: ["/api/inquiries"],
    enabled: isAdmin,
    refetchInterval: 3000,
  });

  const pendingInquiriesCount = inquiries.filter((inq) => inq.status === "Отправлено").length;
  const unseenOrdersCount = orders.filter((o) => !o.adminSeen).length;

  // Play sound when new orders or inquiries arrive
  useEffect(() => {
    if (prevCountsRef.current.orders > 0 && unseenOrdersCount > prevCountsRef.current.orders) {
      playNotificationSound();
    }
    if (prevCountsRef.current.inquiries > 0 && pendingInquiriesCount > prevCountsRef.current.inquiries) {
      playNotificationSound();
    }
    prevCountsRef.current = { orders: unseenOrdersCount, inquiries: pendingInquiriesCount };
  }, [unseenOrdersCount, pendingInquiriesCount, playNotificationSound]);


  // Approve customer mutation
  const approveMutation = useMutation({
    mutationFn: async ({ id, customerType }: { id: string; customerType: string }) => {
      await apiRequest("PATCH", `/api/customers/${id}`, { status: 'approved', customerType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Заявка одобрена",
        description: "Заявка успешно одобрена",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось одобрить заявку",
        variant: "destructive",
      });
    },
  });

  // Reject customer mutation
  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/customers/${id}`, { status: 'rejected' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Заявка отклонена",
        description: "Заявка успешно отклонена",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отклонить заявку",
        variant: "destructive",
      });
    },
  });

  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: async (data: InsertProduct) => {
      await apiRequest("POST", "/api/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setShowProductForm(false);
      toast({
        title: "Товар добавлен",
        description: "Товар успешно добавлен",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось добавить товар",
        variant: "destructive",
      });
    },
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Товар удален",
        description: "Товар успешно удален",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить товар",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (id: string, customerType: string) => {
    approveMutation.mutate({ id, customerType });
  };

  const handleReject = (id: string) => {
    rejectMutation.mutate(id);
  };

  // Update customer mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Customer> }) => {
      await apiRequest("PATCH", `/api/customers/${id}`, updates); // Changed to patch customers
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] }); // Invalidate customers
      toast({
        title: "Клиент обновлен",
        description: "Изменения успешно сохранены",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить клиента",
        variant: "destructive",
      });
    },
  });

  const handleUpdateCustomer = (id: string, updates: Partial<Customer>) => {
    updateCustomerMutation.mutate({ id, updates });
  };

  // Delete customer mutation
  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Клиент удален",
        description: "Клиент и все его заказы успешно удалены",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить клиента",
        variant: "destructive",
      });
    },
  });

  const handleDeleteCustomer = (id: string) => {
    deleteCustomerMutation.mutate(id);
  };

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Product> }) => {
      await apiRequest("PATCH", `/api/products/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Товар обновлен",
        description: "Изменения успешно сохранены",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить товар",
        variant: "destructive",
      });
    },
  });

  const handleEditProduct = (id: string, updates: Partial<Product>) => {
    updateProductMutation.mutate({ id, updates });
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm("Вы уверены, что хотите удалить этот товар?")) {
      deleteProductMutation.mutate(id);
    }
  };

  // Bulk import mutation
  const bulkImportMutation = useMutation({
    mutationFn: async (productsToImport: InsertProduct[]) => {
      await apiRequest("POST", "/api/products/bulk-import", { products: productsToImport });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Товары импортированы",
        description: "Товары успешно добавлены в базу данных",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка импорта",
        description: error.message || "Не удалось импортировать товары",
        variant: "destructive",
      });
    },
  });

  const handleExportProducts = () => {
    exportProductsToCSV(products);
  };

  const handleImportProducts = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const importedProducts = await importProductsFromCSV(file);
      bulkImportMutation.mutate(importedProducts);
    } catch (error: any) {
      toast({
        title: "Ошибка чтения файла",
        description: error.message || "Не удалось прочитать CSV файл",
        variant: "destructive",
      });
    }
    
    // Reset file input
    event.target.value = "";
  };

  // Delete order mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Заказ удален",
        description: "Заказ успешно удален",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить заказ",
        variant: "destructive",
      });
    },
  });

  const handleDeleteOrder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Вы уверены, что хотите удалить этот заказ? Это действие нельзя отменить.")) {
      deleteOrderMutation.mutate(id);
    }
  };

  if (!isAdmin && !authLoading) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        pendingRegistrationsCount={pendingCount}
        pendingInquiriesCount={pendingInquiriesCount}
        unseenOrdersCount={unseenOrdersCount}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b bg-background p-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsSidebarOpen(true)}
            data-testid="button-open-admin-sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-xl md:text-2xl font-bold">
            {activeSection === "dashboard" && "Дашборд"}
            {activeSection === "products" && "Управление товарами"}
            {activeSection === "registrations" && "Список клиентов"}
            {activeSection === "orders" && "Заказы"}
            {activeSection === "inquiries" && "Запросы"}
            {activeSection === "settings" && "Настройки"}
          </h1>
        </header>

        <main className="flex-1 overflow-auto p-3 md:p-6">
          {activeSection === "dashboard" && (
            <div className="space-y-6">
              {analyticsLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
                </div>
              ) : analytics ? (
                <>
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Выручка (месяц)</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{analytics.revenueThisMonth.toLocaleString('ru-RU')} ֏</div>
                        <div className="flex items-center gap-1 mt-1 text-xs">
                          {analytics.revenueThisMonth >= analytics.revenueLastMonth ? (
                            <TrendingUp className="h-3 w-3 text-green-600" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-500" />
                          )}
                          <span className={analytics.revenueThisMonth >= analytics.revenueLastMonth ? "text-green-600" : "text-red-500"}>
                            {analytics.revenueLastMonth > 0
                              ? `${Math.abs(Math.round((analytics.revenueThisMonth - analytics.revenueLastMonth) / analytics.revenueLastMonth * 100))}% vs прошлый месяц`
                              : "Нет данных за прошлый месяц"}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Всего заказов</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{analytics.totalOrders}</div>
                        <div className="text-xs text-muted-foreground mt-1">За всё время</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Клиентов</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{analytics.totalCustomers}</div>
                        <div className="text-xs text-muted-foreground mt-1">Зарегистрировано</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Задолженность</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-600">{analytics.overdueTotal.toLocaleString('ru-RU')} ֏</div>
                        <div className="text-xs text-muted-foreground mt-1">Просрочено (&gt;7 дней)</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Revenue / Orders Chart */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Заказы за 30 дней</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={220}>
                          <LineChart data={analytics.dailyOrders}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                            <Tooltip
                              formatter={(value: any) => [value, 'Заказов']}
                              labelFormatter={(l) => `Дата: ${l}`}
                            />
                            <Line type="monotone" dataKey="orders" stroke="#1d4ed8" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Выручка по типу клиента</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie
                              data={analytics.revenueByType.filter((d: any) => d.value > 0)}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              dataKey="value"
                              nameKey="type"
                              label={({ type, percent }: any) => `${type} ${(percent * 100).toFixed(0)}%`}
                              labelLine={false}
                            >
                              {analytics.revenueByType.map((_: any, index: number) => (
                                <Cell key={index} fill={["#1d4ed8", "#16a34a", "#ea580c"][index % 3]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v: any) => `${v.toLocaleString('ru-RU')} ֏`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Top Customers & Products */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Топ-5 клиентов по выручке</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={analytics.topCustomers} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                            <Tooltip formatter={(v: any) => `${v.toLocaleString('ru-RU')} ֏`} />
                            <Bar dataKey="revenue" fill="#1d4ed8" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Топ-5 категорий по выручке</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={analytics.topCategories} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={160} />
                            <Tooltip formatter={(v: any) => `${v.toLocaleString('ru-RU')} ֏`} />
                            <Bar dataKey="revenue" fill="#16a34a" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <div className="text-center py-16 text-muted-foreground">Нет данных для отображения</div>
              )}
            </div>
          )}

          {activeSection === "products" && (
            <div className="space-y-6">
              {!showProductForm && (
                <div className="flex gap-3 flex-wrap">
                  <Button
                    onClick={() => setShowProductForm(true)}
                    data-testid="button-add-product"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить товар
                  </Button>
                  <Button
                    onClick={handleExportProducts}
                    variant="outline"
                    data-testid="button-export-products"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Экспортировать в CSV
                  </Button>
                  <label htmlFor="import-csv">
                    <Button
                      variant="outline"
                      data-testid="button-import-products"
                      onClick={() => document.getElementById("import-csv")?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Импортировать из CSV
                    </Button>
                  </label>
                  <input
                    id="import-csv"
                    type="file"
                    accept=".csv"
                    onChange={handleImportProducts}
                    style={{ display: "none" }}
                    data-testid="input-import-csv"
                  />
                </div>
              )}

              {showProductForm ? (
                <div className="max-w-2xl">
                  <ProductForm
                    onSubmit={(data) => {
                      createProductMutation.mutate({
                        ...data,
                        price: parseInt(data.price as string),
                        availableQuantity: parseInt(data.availableQuantity as string),
                        sku: data.sku || null,
                        eta: data.eta || null,
                        description: data.description || null,
                        imageUrl: null,
                        visibleCustomerTypes: (data as any).visibleCustomerTypes || undefined,
                      });
                    }}
                    onCancel={() => setShowProductForm(false)}
                  />
                </div>
              ) : productsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
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
              ) : (
                <div>
                  <h2 className="mb-4 text-lg font-semibold">Все товары</h2>
                  <ProductListTable 
                    products={products} 
                    adminMode={true}
                    onEdit={handleEditProduct}
                    onDelete={handleDeleteProduct}
                    customerType="дилер"
                    corporateMarkupPercentage={settings?.corporateMarkupPercentage}
                    governmentMarkupPercentage={settings?.governmentMarkupPercentage}
                  />
                </div>
              )}
            </div>
          )}

          {activeSection === "registrations" && (
            <div className="max-w-4xl">
              {customersLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-32 w-full rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : customers.length === 0 ? (
                <p className="text-muted-foreground">Нет клиентов или заявок</p>
              ) : (
                <div className="space-y-4">
                  {/* Filters */}
                  <div className="flex gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-sm font-medium mb-2 block">Статус</label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger data-testid="select-status-filter">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Все статусы</SelectItem>
                          <SelectItem value="pending">Ожидание</SelectItem>
                          <SelectItem value="approved">Одобрено</SelectItem>
                          <SelectItem value="limited">Ограничено</SelectItem>
                          <SelectItem value="paused">Приостановлено</SelectItem>
                          <SelectItem value="rejected">Отклонено</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-sm font-medium mb-2 block">Просроченные платежи</label>
                      <Select value={debtFilter} onValueChange={setDebtFilter}>
                        <SelectTrigger data-testid="select-debt-filter">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Все клиенты</SelectItem>
                          <SelectItem value="debt">Должники</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Customers List */}
                  <RegistrationList
                    registrations={customers.filter((customer: any) => {
                      // Apply status filter
                      if (statusFilter !== "all" && customer.status !== statusFilter) {
                        return false;
                      }
                      // Apply debt filter
                      if (debtFilter === "debt" && (!customer.overdueAmount || customer.overdueAmount === 0)) {
                        return false;
                      }
                      return true;
                    }) as any}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onUpdate={handleUpdateCustomer}
                    onDelete={handleDeleteCustomer}
                  />
                </div>
              )}
            </div>
          )}

          {activeSection === "orders" && (
            <div>
              {ordersLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-md" />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center text-muted-foreground">
                  Нет заказов
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => {
                    const customer = customers.find(c => c.id === order.customerId);
                    return (
                      <Card
                      key={order.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={async () => {
                        if (!order.adminSeen) {
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
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-1 flex-1">
                            <div className="font-medium">Заказ #{order.orderNumber}</div>
                            <div className="text-sm text-muted-foreground">
                              {customer?.companyName || "Unknown Customer"}
                            </div>
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
                          <div className="flex flex-col items-end gap-2">
                            <div className="text-lg font-semibold">
                              {order.total.toLocaleString()} ֏
                            </div>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={(e) => handleDeleteOrder(order.id, e)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeSection === "inquiries" && (
            <div className="space-y-4">
              {inquiriesLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-md" />
                  ))}
                </div>
              ) : inquiries.length === 0 ? (
                <p className="text-muted-foreground">Нет запросов</p>
              ) : (
                <div>
                  {pendingInquiriesCount > 0 && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-red-700 font-medium">{pendingInquiriesCount} новых запросов</p>
                    </div>
                  )}
                  <AdminInquiriesSection inquiries={inquiries} customers={customers} products={products} expandedImageUrl={expandedImageUrl} setExpandedImageUrl={setExpandedImageUrl} />
                </div>
              )}
            </div>
          )}

          {activeSection === "settings" && (
            <SettingsPanel />
          )}
        </main>
      </div>
    </div>
  );
}

function AdminInquiriesSection({ inquiries, customers = [], products = [], expandedImageUrl, setExpandedImageUrl }: { inquiries: any[]; customers?: any[]; products?: any[]; expandedImageUrl?: string | null; setExpandedImageUrl?: (url: string | null) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [offerForms, setOfferForms] = useState<{ [key: string]: any[] }>({});
  const { toast } = useToast();
  const deliveryOptions = ["1-2 дня", "3-7 дней", "7-14 дней", "14-21 дней", "22-35 дней", "30-45 дней", "40-60 дней", "65-90 дней"];

  const createOfferMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/offers", data);
    },
    onSuccess: () => {
      toast({ title: "Предложение отправлено!" });
      setOfferForms({});
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отправить предложение",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (inquiryId: string) => {
      return await apiRequest("PATCH", `/api/inquiries/${inquiryId}/reject`, {});
    },
    onSuccess: () => {
      toast({ title: "Запрос отклонен" });
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
    },
  });

  const deleteInquiryMutation = useMutation({
    mutationFn: async (inquiryId: string) => {
      return await apiRequest("DELETE", `/api/inquiries/${inquiryId}`);
    },
    onSuccess: () => {
      toast({ title: "Запрос удален" });
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить запрос",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Отправлено": return "bg-yellow-100 text-yellow-800";
      case "Получено предложение": return "bg-blue-100 text-blue-800";
      case "Предложение отправлено": return "bg-blue-100 text-blue-800";
      case "Заказано": return "bg-green-100 text-green-800";
      case "Нет предложения": return "bg-red-100 text-red-800";
      case "Новый запрос": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-3">
      {inquiries.map((inquiry: any) => {
        const offers = offerForms[inquiry.id] || [];
        const customer = customers.find(c => c.id === inquiry.customerId);
        let displayStatus = inquiry.status;
        if (inquiry.status === "Отправлено") {
          displayStatus = "Новый запрос";
        } else if (inquiry.status === "Получено предложение") {
          displayStatus = "Предложение отправлено";
        }
        
        return (
          <Card key={inquiry.id} className="p-0 overflow-hidden cursor-default hover:shadow-sm transition-shadow">
            <div 
              className="p-4 cursor-pointer hover:bg-muted/50 transition-colors flex justify-between items-center" 
              onClick={() => setExpandedId(expandedId === inquiry.id ? null : inquiry.id)}
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(displayStatus)}`}>
                    {displayStatus}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(inquiry.createdAt).toLocaleDateString("ru-RU")}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="font-semibold">{customer?.companyName || "Unknown"}</span>
                  {inquiry.deadline && (
                    <span className="text-xs text-gray-600">
                      Срок: {new Date(inquiry.deadline).toLocaleDateString("ru-RU")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Вы уверены, что хотите удалить этот запрос?")) {
                      deleteInquiryMutation.mutate(inquiry.id);
                    }
                  }}
                  disabled={deleteInquiryMutation.isPending}
                  data-testid={`button-delete-inquiry-${inquiry.id}`}
                >
                  <X className="h-4 w-4" />
                </Button>
                {expandedId === inquiry.id ? <ChevronUp /> : <ChevronDown />}
              </div>
            </div>

            {expandedId === inquiry.id && (
              <div className="p-4 pt-0 space-y-3">
                <div className="mt-0 space-y-3 border-t pt-3">
                  <div>
                    <div className="space-y-3">
                      {inquiry.productsRequested?.map((product: any, idx: number) => (
                        <div key={idx} className="border rounded p-2">
                          <h4 className="font-semibold text-sm">{product.category || "Без категории"}</h4>
                          <ul className="mt-1 space-y-1 text-sm">
                            <li className="text-sm">- {product.description} (Кол-во: {product.quantity})</li>
                          </ul>
                          {product.image && setExpandedImageUrl && (
                            <div className="mt-2">
                              <img 
                                src={product.image} 
                                alt="Product" 
                                className="h-16 w-16 object-cover rounded cursor-pointer hover:opacity-80"
                                onClick={() => setExpandedImageUrl(product.image)}
                                data-testid={`img-thumbnail-${inquiry.id}-${idx}`}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {inquiry.offers && inquiry.offers.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm">Существующие предложения:</h4>
                      <div className="mt-1 space-y-1">
                        {inquiry.offers.map((offer: any) => (
                          <Card key={offer.id} className="p-2 bg-green-50 text-sm">
                            {offer.productName} - {offer.price} AMD {offer.quantity && `(Кол-во: ${offer.quantity})`} ({offer.deliveryTime})
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Добавить предложение:</h4>
                    {offers.map((offer, idx) => (
                      <div key={idx} className="p-2 bg-gray-50 rounded border space-y-1 text-sm" onClick={(e) => e.stopPropagation()}>
                        <Input type="text" value={offer.productName || ""} onChange={(e) => { offers[idx].productName = e.target.value; setOfferForms({...offerForms}); }} placeholder="Название товара*" />
                        <div className="flex gap-2 flex-wrap">
                          <Input type="number" value={offer.price || ""} onChange={(e) => { offers[idx].price = Number(e.target.value) || 0; setOfferForms({...offerForms}); }} placeholder="Цена (AMD)*" className="w-24 min-w-0" />
                          <Input type="number" value={offer.quantity || 1} onChange={(e) => { offers[idx].quantity = Math.max(1, Number(e.target.value)); setOfferForms({...offerForms}); }} placeholder="Кол-во" className="w-20 min-w-0" />
                          <select value={offer.deliveryTime} onChange={(e) => { offers[idx].deliveryTime = e.target.value; setOfferForms({...offerForms}); }} className="border rounded px-2 min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
                            <option value="">Сроки...</option>
                            {deliveryOptions.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
                          </select>
                        </div>
                        <Input value={offer.comment || ""} onChange={(e) => { offers[idx].comment = e.target.value; setOfferForms({...offerForms}); }} placeholder="Комментарий (опционально)" />
                      </div>
                    ))}
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); const newOffers = [...offers, { productName: "", price: 0, quantity: 1, deliveryTime: "", comment: "" }]; setOfferForms({...offerForms, [inquiry.id]: newOffers}); }}>+ Добавить строку</Button>
                      {offers.length > 0 && <Button size="sm" onClick={(e) => { e.stopPropagation(); offers.forEach(offer => { if (offer.productName && offer.price && offer.quantity && offer.deliveryTime) { createOfferMutation.mutate({ ...offer, inquiryId: inquiry.id }); } }); }} disabled={createOfferMutation.isPending || offers.some(o => !o.productName || !o.price || !o.quantity || !o.deliveryTime)}>Отправить</Button>}
                    </div>
                  </div>

                  {inquiry.status === "Отправлено" && (
                    <Button size="sm" variant="destructive" onClick={() => rejectMutation.mutate(inquiry.id)} disabled={rejectMutation.isPending}>Нет предложения</Button>
                  )}
                </div>
              </div>
            )}
          </Card>
        );
      })}

      <Dialog open={!!expandedImageUrl} onOpenChange={(open) => !open && setExpandedImageUrl?.(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Фото товара</DialogTitle>
          </DialogHeader>
          {expandedImageUrl && (
            <img src={expandedImageUrl} alt="Expanded product" className="w-full h-auto rounded" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}