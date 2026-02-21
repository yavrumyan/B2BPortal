import type { Product, InsertProduct } from "@shared/schema";

export function exportProductsToCSV(products: Product[]): void {
  if (products.length === 0) {
    alert("Нет товаров для экспорта");
    return;
  }

  // Prepare CSV headers (id is first column for identification)
  const headers = [
    "id",
    "name",
    "sku",
    "price",
    "stock",
    "eta",
    "description",
    "availableQuantity",
    "moq",
    "brand",
    "category",
    "visibleCustomerTypes"
  ];

  // Escape CSV value (handle quotes and commas)
  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Build CSV content
  const csvContent = [
    headers.join(","),
    ...products.map((product) =>
      headers
        .map((header) => {
          if (header === "visibleCustomerTypes" && product.visibleCustomerTypes) {
            return escapeCSV((product.visibleCustomerTypes as string[]).join(";"));
          }
          return escapeCSV(product[header as keyof Product]);
        })
        .join(",")
    )
  ].join("\n");

  // Create and download file with UTF-8 BOM for Excel compatibility
  const BOM = "\uFEFF"; // UTF-8 BOM character
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `products_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function importProductsFromCSV(file: File): Promise<(InsertProduct & { id?: string })[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const csv = event.target?.result as string;
        const lines = csv.split("\n");

        if (lines.length < 2) {
          reject(new Error("CSV файл должен содержать заголовок и минимум одну строку с данными"));
          return;
        }

        const headers = lines[0].split(",").map(h => h.trim());
        const products: (InsertProduct & { id?: string })[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue; // Skip empty lines

          // Simple CSV parser (handles quoted values)
          const values: string[] = [];
          let current = "";
          let inQuotes = false;

          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];

            if (char === '"') {
              if (inQuotes && nextChar === '"') {
                current += '"';
                j++; // Skip next quote
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === "," && !inQuotes) {
              values.push(current.trim());
              current = "";
            } else {
              current += char;
            }
          }
          values.push(current.trim());

          // Parse the product (including optional id field)
          const product: any = {};
          headers.forEach((header, index) => {
            const value = values[index];
            if (!value) return; // Skip empty values

            if (header === "price" || header === "availableQuantity" || header === "moq") {
              product[header] = parseInt(value);
            } else if (header === "visibleCustomerTypes") {
              // Parse semicolon-separated customer types
              product[header] = value.split(";").map(t => t.trim()).filter(t => t);
            } else {
              product[header] = value;
            }
          });

          // Validate required fields
          if (!product.name || !product.stock) {
            reject(new Error(`Строка ${i + 1}: Поле 'name' и 'stock' обязательны`));
            return;
          }

          products.push(product as InsertProduct & { id?: string });
        }

        if (products.length === 0) {
          reject(new Error("CSV файл не содержит данных о товарах"));
          return;
        }

        resolve(products);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Ошибка при чтении файла"));
    };

    reader.readAsText(file, "UTF-8");
  });
}
