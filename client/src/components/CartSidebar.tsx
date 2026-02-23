import { X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  moq?: number;
  stock?: number;
}

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity?: (itemId: string, quantity: number) => void;
  onRemoveItem?: (itemId: string) => void;
  onCheckout?: () => void;
}

export default function CartSidebar({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}: CartSidebarProps) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        data-testid="cart-overlay"
      />
      <div className="fixed right-0 top-0 z-50 h-screen w-full max-w-md border-l bg-background shadow-lg">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-lg font-semibold">Корзина</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              data-testid="button-close-cart"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="text-muted-foreground">Корзина пуста</div>
              </div>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 rounded-md border p-3"
                      data-testid={`cart-item-${item.id}`}
                    >
                      <div className="h-16 w-16 overflow-hidden rounded border bg-muted">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                            Нет фото
                          </div>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-medium">{item.name}</div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => onRemoveItem?.(item.id)}
                            data-testid={`button-remove-${item.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => {
                                const newQty = item.quantity - 1;
                                const minQty = item.moq || 1;
                                if (newQty >= minQty) {
                                  onUpdateQuantity?.(item.id, newQty);
                                }
                              }}
                              disabled={(item.moq || 1) >= item.quantity}
                              data-testid={`button-decrease-${item.id}`}
                            >
                              −
                            </Button>
                            <div className="w-8 text-center text-sm font-semibold">{item.quantity}</div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => {
                                const newQty = item.quantity + 1;
                                const maxQty = item.stock || Infinity;
                                if (newQty <= maxQty) {
                                  onUpdateQuantity?.(item.id, newQty);
                                }
                              }}
                              disabled={item.stock !== undefined && item.quantity >= item.stock}
                              data-testid={`button-increase-${item.id}`}
                            >
                              +
                            </Button>
                          </div>

                          <div className="text-sm font-semibold" data-testid={`text-subtotal-${item.id}`}>
                            {(item.price * item.quantity).toLocaleString()} ֏
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="border-t p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Итого товаров:</span>
                    <span>{items.reduce((sum, item) => sum + item.quantity, 0)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Итого:</span>
                    <span className="text-xl font-bold" data-testid="text-total">
                      {total.toLocaleString()} ֏
                    </span>
                  </div>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={onCheckout}
                    data-testid="button-checkout"
                  >
                    Оформить заказ
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
