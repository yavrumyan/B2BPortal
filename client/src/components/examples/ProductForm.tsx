import ProductForm from '../ProductForm';

export default function ProductFormExample() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        <ProductForm
          onSubmit={(data) => console.log('Product submitted:', data)}
          onCancel={() => console.log('Cancelled')}
        />
      </div>
    </div>
  );
}
