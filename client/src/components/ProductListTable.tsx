
import { useState } from "react";
import { ShoppingCart, Plus, Minus, X, Save, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Product } from "@shared/schema";
import { calculatePrice } from "@shared/utils";

type SortKey = "name" | "price" | "stock" | "eta" | null;
type SortOrder = "asc" | "desc";

interface ProductListTableProps {
  products: Product[];
  onAddToCart?: (productId: string, quantity: number) => void;
  adminMode?: boolean;
  onEdit?: (productId: string, updates: Partial<Product>) => void;
  onDelete?: (productId: string) => void;
  customerType?: string;
  corporateMarkupPercentage?: number;
  governmentMarkupPercentage?: number;
}

export default function ProductListTable({
  products,
  onAddToCart,
  adminMode = false,
  onEdit,
  onDelete,
  customerType = "дилер",
  corporateMarkupPercentage = 10,
  governmentMarkupPercentage = 10,
}: ProductListTableProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [editingProduct, setEditingProduct] = useState<Record<string, Partial<Product>>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const getSortedAndFilteredProducts = () => {
    let result = products.filter((product) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        product.name.toLowerCase().includes(searchLower) ||
        (product.sku && product.sku.toLowerCase().includes(searchLower))
      );
    });

    if (sortKey) {
      result.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (sortKey) {
          case "name":
            aVal = a.name.toLowerCase();
            bVal = b.name.toLowerCase();
            break;
          case "price":
            aVal = a.price;
            bVal = b.price;
            break;
          case "stock":
            const stockOrder = { in_stock: 0, low_stock: 1, on_order: 2, out_of_stock: 3 };
            aVal = stockOrder[a.stock as keyof typeof stockOrder] ?? 4;
            bVal = stockOrder[b.stock as keyof typeof stockOrder] ?? 4;
            break;
          case "eta":
            aVal = a.eta || "";
            bVal = b.eta || "";
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
        if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  };

  const filteredProducts = getSortedAndFilteredProducts();

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

  const getStockBadge = (stock: Product["stock"]) => {
    switch (stock) {
      case "in_stock":
        return <Badge className="bg-green-600 text-white">В наличии</Badge>;
      case "low_stock":
        return <Badge className="bg-yellow-600 text-white">Call</Badge>;
      case "out_of_stock":
        return <Badge variant="destructive">Нет в наличии</Badge>;
      case "on_order":
        return <Badge className="bg-blue-600 text-white">Под заказ</Badge>;
    }
  };

  const handleQuantityChange = (productId: string, value: string) => {
    const product = products.find((p) => p.id === productId);
    const minQty = Math.max(1, product?.moq ?? 0);
    const maxQty = product?.availableQuantity ?? 9999;
    const num = parseInt(value) || 0;
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(minQty, Math.min(num, maxQty)) }));
  };

  const incrementQuantity = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    const minQty = Math.max(1, product?.moq ?? 0);
    const maxQty = product?.availableQuantity ?? 9999;
    setQuantities((prev) => ({
      ...prev,
      [productId]: Math.min((prev[productId] || minQty) + 1, maxQty),
    }));
  };

  const decrementQuantity = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    const minQty = Math.max(1, product?.moq ?? 0);
    setQuantities((prev) => ({
      ...prev,
      [productId]: Math.max(minQty, (prev[productId] || minQty) - 1),
    }));
  };

  const handleAddToCart = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    const minQty = Math.max(1, product?.moq ?? 0);
    const quantity = quantities[productId] || minQty;
    onAddToCart?.(productId, quantity);
    console.log(`Added product ${productId} with quantity ${quantity}`);
  };

  const handleFieldChange = (productId: string, field: keyof Product, value: any) => {
    setEditingProduct((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value,
      },
    }));
  };

  const handleSave = (productId: string) => {
    const updates = editingProduct[productId];
    if (updates && Object.keys(updates).length > 0) {
      onEdit?.(productId, updates);
      setEditingProduct((prev) => {
        const newState = { ...prev };
        delete newState[productId];
        return newState;
      });
    }
  };

  const getEditedValue = (productId: string, field: keyof Product, originalValue: any) => {
    return editingProduct[productId]?.[field] ?? originalValue;
  };

  const renderMobileProductCard = (product: Product) => {
    const minQty = Math.max(1, product.moq ?? 0);
    return (
      <div
        key={product.id}
        className="border-b p-3 space-y-2"
        data-testid={`product-card-${product.id}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-foreground truncate" data-testid={`text-product-name-${product.id}`}>
              {product.name}
            </div>
            {product.sku && (
              <div className="text-xs text-muted-foreground" data-testid={`text-sku-${product.id}`}>
                {product.sku}
              </div>
            )}
            {product.brand && (
              <div className="text-xs text-muted-foreground" data-testid={`text-brand-${product.id}`}>
                {product.brand}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="font-semibold text-sm" data-testid={`text-price-${product.id}`}>
              {calculatePrice(product.price, customerType, corporateMarkupPercentage, governmentMarkupPercentage).toLocaleString()} ֏
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span data-testid={`badge-stock-${product.id}`}>{getStockBadge(product.stock)}</span>
          <span className="text-xs text-muted-foreground" data-testid={`text-eta-${product.id}`}>
            {product.eta || "—"}
          </span>
          {product.moq && product.moq > 0 && (
            <span className="text-xs text-muted-foreground" data-testid={`text-moq-${product.id}`}>MOQ: {product.moq}</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => decrementQuantity(product.id)}
              data-testid={`button-decrease-${product.id}`}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Input
              type="number"
              min="0"
              max={product.availableQuantity}
              value={quantities[product.id] || minQty}
              onChange={(e) => handleQuantityChange(product.id, e.target.value)}
              className="h-9 w-14 text-center"
              data-testid={`input-quantity-${product.id}`}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => incrementQuantity(product.id)}
              data-testid={`button-increase-${product.id}`}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <Button
            size="sm"
            onClick={() => handleAddToCart(product.id)}
            className="flex-1 bg-green-600"
            data-testid={`button-add-cart-${product.id}`}
          >
            <ShoppingCart className="h-4 w-4 mr-1" />
            В корзину
          </Button>
        </div>
      </div>
    );
  };

  const renderDesktopTable = () => (
    <div className="overflow-x-auto">
      <div className="min-w-full">
        <div className={`sticky top-0 z-10 grid ${adminMode ? 'grid-cols-[1fr_120px_120px_120px_80px_100px_120px]' : 'grid-cols-[1fr_100px_120px_120px_120px_80px_140px_100px]'} gap-4 border-b bg-muted/50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground`}>
          <div
            onClick={() => handleSort("name")}
            className="cursor-pointer hover-elevate p-1 -m-1 rounded flex items-center gap-1"
            data-testid="header-sort-name"
          >
            Наименование
            {sortKey === "name" && (
              sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            )}
          </div>
          {!adminMode && <div>Бренд</div>}
          <div
            onClick={() => handleSort("price")}
            className="cursor-pointer hover-elevate p-1 -m-1 rounded flex items-center gap-1"
            data-testid="header-sort-price"
          >
            Цена
            {sortKey === "price" && (
              sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            )}
          </div>
          <div
            onClick={() => handleSort("stock")}
            className="cursor-pointer hover-elevate p-1 -m-1 rounded flex items-center gap-1"
            data-testid="header-sort-stock"
          >
            Статус
            {sortKey === "stock" && (
              sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            )}
          </div>
          <div
            onClick={() => handleSort("eta")}
            className="cursor-pointer hover-elevate p-1 -m-1 rounded flex items-center gap-1"
            data-testid="header-sort-eta"
          >
            Срок доставки
            {sortKey === "eta" && (
              sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            )}
          </div>
          <div>MOQ (мин. кол-во)</div>
          {adminMode ? (
            <>
              <div>Склад</div>
              <div>Действия</div>
            </>
          ) : (
            <>
              <div>Количество</div>
              <div></div>
            </>
          )}
        </div>

        {filteredProducts.map((product, index) => {
          return (
          <div
            key={product.id}
            className={`grid ${adminMode ? 'grid-cols-[1fr_120px_120px_120px_80px_100px_120px]' : 'grid-cols-[1fr_100px_120px_120px_120px_80px_140px_100px]'} gap-4 border-b px-4 py-3 hover-elevate ${
              index % 2 === 0 ? "bg-background" : "bg-muted/20"
            }`}
            data-testid={`product-row-${product.id}`}
          >
        <div className="flex flex-col justify-center">
          {adminMode ? (
            <>
              <Input
                value={getEditedValue(product.id, "name", product.name)}
                onChange={(e) => handleFieldChange(product.id, "name", e.target.value)}
                className="mb-1 font-medium"
                data-testid={`input-edit-name-${product.id}`}
              />
              <div className="flex gap-1">
                <Input
                  value={getEditedValue(product.id, "sku", product.sku || "")}
                  onChange={(e) => handleFieldChange(product.id, "sku", e.target.value)}
                  placeholder="Артикул"
                  className="text-xs flex-1 min-w-0"
                  data-testid={`input-edit-sku-${product.id}`}
                />
                <Input
                  value={getEditedValue(product.id, "brand", product.brand || "")}
                  onChange={(e) => handleFieldChange(product.id, "brand", e.target.value)}
                  placeholder="Бренд"
                  className="text-xs flex-1 min-w-0"
                  data-testid={`input-edit-brand-${product.id}`}
                />
                <Select
                  value={getEditedValue(product.id, "category", product.category || "")}
                  onValueChange={(value) => handleFieldChange(product.id, "category", value)}
                >
                  <SelectTrigger className="text-xs flex-1 min-w-0 h-9" data-testid={`select-edit-category-${product.id}`}>
                    <SelectValue placeholder="Категория" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div className="font-medium text-foreground" data-testid={`text-product-name-${product.id}`}>
                {product.name}
              </div>
              {product.sku && (
                <div className="text-xs text-muted-foreground">
                  Артикул: {product.sku}
                </div>
              )}
            </>
          )}
        </div>

        {!adminMode && (
          <div className="flex items-center">
            <div className="text-sm text-muted-foreground" data-testid={`text-brand-${product.id}`}>
              {product.brand || "—"}
            </div>
          </div>
        )}

        <div className="flex items-center">
          {adminMode ? (
            <Input
              type="number"
              value={getEditedValue(product.id, "price", product.price)}
              onChange={(e) => handleFieldChange(product.id, "price", parseInt(e.target.value) || 0)}
              className="w-full"
              data-testid={`input-edit-price-${product.id}`}
            />
          ) : (
            <div className="text-lg font-semibold" data-testid={`text-price-${product.id}`}>
              {calculatePrice(product.price, customerType, corporateMarkupPercentage, governmentMarkupPercentage).toLocaleString()} ֏
            </div>
          )}
        </div>

        <div className="flex items-center">
          {adminMode ? (
            <Select
              value={getEditedValue(product.id, "stock", product.stock)}
              onValueChange={(value) => handleFieldChange(product.id, "stock", value)}
            >
              <SelectTrigger className="w-full" data-testid={`select-edit-stock-${product.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_stock">В наличии</SelectItem>
                <SelectItem value="low_stock">Call</SelectItem>
                <SelectItem value="out_of_stock">Нет в наличии</SelectItem>
                <SelectItem value="on_order">Под заказ</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            getStockBadge(product.stock)
          )}
        </div>

        <div className="flex items-center">
          {adminMode ? (
            <Select
              value={getEditedValue(product.id, "eta", product.eta || "1-2 дня") || "1-2 дня"}
              onValueChange={(value) => handleFieldChange(product.id, "eta", value)}
            >
              <SelectTrigger className="w-full" data-testid={`select-edit-eta-${product.id}`}>
                <SelectValue />
              </SelectTrigger>
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
          ) : (
            product.eta ? (
              <div className="text-sm text-muted-foreground">{product.eta}</div>
            ) : (
              <div className="text-sm text-muted-foreground">—</div>
            )
          )}
        </div>

        <div className="flex items-center">
          {adminMode ? (
            <Input
              type="number"
              min="0"
              value={getEditedValue(product.id, "moq", product.moq || 0)}
              onChange={(e) => handleFieldChange(product.id, "moq", parseInt(e.target.value) || 0)}
              className="w-full"
              placeholder="0"
              data-testid={`input-edit-moq-${product.id}`}
            />
          ) : (
            <div className="text-sm text-muted-foreground">
              {product.moq && product.moq > 0 ? `${product.moq}` : "—"}
            </div>
          )}
        </div>

        {adminMode ? (
          <>
            <div className="flex items-center">
              <Input
                type="number"
                value={getEditedValue(product.id, "availableQuantity", product.availableQuantity)}
                onChange={(e) => handleFieldChange(product.id, "availableQuantity", parseInt(e.target.value) || 0)}
                className="w-full"
                data-testid={`input-edit-quantity-${product.id}`}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="bg-green-600 flex-1"
                onClick={() => handleSave(product.id)}
                data-testid={`button-save-${product.id}`}
              >
                <Save className="h-4 w-4 mr-1" />
                SAVE
              </Button>
              <Button
                variant="destructive"
                size="icon"
                onClick={() => onDelete?.(product.id)}
                data-testid={`button-delete-${product.id}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => decrementQuantity(product.id)}
                data-testid={`button-decrease-${product.id}`}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                min="0"
                max={product.availableQuantity}
                value={quantities[product.id] || 1}
                onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                className="h-9 w-16 text-center"
                data-testid={`input-quantity-${product.id}`}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => incrementQuantity(product.id)}
                data-testid={`button-increase-${product.id}`}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            <div className="flex items-center">
              <Button
                size="sm"
                onClick={() => handleAddToCart(product.id)}
                className="w-full bg-green-600"
                data-testid={`button-add-cart-${product.id}`}
              >
                <ShoppingCart className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
          </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="w-full">
      {adminMode && (
        <div className="mb-4">
          <Input
            placeholder="Поиск по названию или артикулу..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-products"
          />
        </div>
      )}
      {filteredProducts.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          {searchTerm ? "Товары не найдены" : "Нет товаров"}
        </div>
      ) : adminMode ? (
        renderDesktopTable()
      ) : (
        <>
          <div className="hidden md:block">
            {renderDesktopTable()}
          </div>
          <div className="md:hidden">
            <div className="flex gap-2 px-3 py-2 border-b bg-muted/50 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort("name")}
                className={`text-xs ${sortKey === "name" ? "font-bold" : ""}`}
                data-testid="mobile-sort-name"
              >
                Имя {sortKey === "name" && (sortOrder === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort("price")}
                className={`text-xs ${sortKey === "price" ? "font-bold" : ""}`}
                data-testid="mobile-sort-price"
              >
                Цена {sortKey === "price" && (sortOrder === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort("stock")}
                className={`text-xs ${sortKey === "stock" ? "font-bold" : ""}`}
                data-testid="mobile-sort-stock"
              >
                Статус {sortKey === "stock" && (sortOrder === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)}
              </Button>
            </div>
            {filteredProducts.map((product) => renderMobileProductCard(product))}
          </div>
        </>
      )}
    </div>
  );
}
