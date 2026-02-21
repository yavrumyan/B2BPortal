import { useState } from 'react';
import CartSidebar from '../CartSidebar';
import { Button } from '@/components/ui/button';

export default function CartSidebarExample() {
  const [isOpen, setIsOpen] = useState(true);
  const [items, setItems] = useState([
    {
      id: '1',
      name: 'Ноутбук HP Pavilion 15',
      price: 450000,
      quantity: 2,
    },
    {
      id: '2',
      name: 'Монитор Dell UltraSharp 27"',
      price: 180000,
      quantity: 1,
    },
  ]);

  return (
    <div className="h-screen w-full bg-background p-4">
      <Button onClick={() => setIsOpen(true)}>Open Cart</Button>
      <CartSidebar
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        items={items}
        onUpdateQuantity={(id, qty) => {
          setItems(items.map(item => item.id === id ? { ...item, quantity: qty } : item));
        }}
        onRemoveItem={(id) => {
          setItems(items.filter(item => item.id !== id));
        }}
        onCheckout={() => console.log('Checkout clicked')}
      />
    </div>
  );
}
