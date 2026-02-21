import ProductListTable from '../ProductListTable';

export default function ProductListTableExample() {
  const mockProducts = [
    {
      id: '1',
      name: 'Ноутбук HP Pavilion 15',
      sku: 'HP-PAV-15-001',
      price: 450000,
      stock: 'in_stock' as const,
      eta: '1-2 дня',
    },
    {
      id: '2',
      name: 'Монитор Dell UltraSharp 27"',
      sku: 'DELL-US-27-002',
      price: 180000,
      stock: 'low_stock' as const,
    },
    {
      id: '3',
      name: 'Клавиатура Logitech MX Keys',
      sku: 'LOG-MX-KEY-003',
      price: 35000,
      stock: 'on_order' as const,
      eta: '5-7 дней',
    },
    {
      id: '4',
      name: 'Мышь Logitech MX Master 3',
      sku: 'LOG-MX-M3-004',
      price: 28000,
      stock: 'in_stock' as const,
    },
  ];

  return (
    <div className="h-screen w-full overflow-auto bg-background">
      <ProductListTable
        products={mockProducts}
        onAddToCart={(id, qty) => console.log('Add to cart:', id, qty)}
      />
    </div>
  );
}
