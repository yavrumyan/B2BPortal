
import { Package, ShoppingBag, User, MessageCircle, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoPath from "@assets/LOG_1763806953898.png";

interface CustomerSidebarProps {
  activeSection?: "products" | "orders" | "inquiries" | "profile";
  onSectionChange?: (section: "products" | "orders" | "inquiries" | "profile") => void;
  orderCount?: number;
  inquiryCount?: number;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function CustomerSidebar({
  activeSection = "products",
  onSectionChange,
  orderCount = 0,
  inquiryCount = 0,
  isOpen = false,
  onClose,
}: CustomerSidebarProps) {
  const sections = [
    {
      id: "products" as const,
      label: "Каталог товаров",
      icon: Package,
    },
    {
      id: "inquiries" as const,
      label: "Мои запросы",
      icon: Mail,
      badge: inquiryCount,
    },
    {
      id: "orders" as const,
      label: "Мои заказы",
      icon: ShoppingBag,
      badge: orderCount,
    },
    {
      id: "profile" as const,
      label: "Мои данные",
      icon: User,
    },
  ];

  const handleSectionClick = (sectionId: typeof activeSection) => {
    onSectionChange?.(sectionId);
    onClose?.();
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={logoPath} 
              alt="Chip.am Logo" 
              className="h-10 w-auto"
              data-testid="img-logo-sidebar"
            />
            <div className="text-lg font-bold text-black">b2b.chip.am</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onClose}
            data-testid="button-close-customer-sidebar"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-1 p-2">
        {sections.map((section: any) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;

          return (
            <Button
              key={section.id}
              variant={isActive ? "secondary" : "ghost"}
              className="w-full justify-start gap-3"
              onClick={() => handleSectionClick(section.id)}
            >
              <Icon className="h-5 w-5" />
              <span>{section.label}</span>
              {section.badge !== undefined && section.badge > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {section.badge}
                </span>
              )}
            </Button>
          );
        })}

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-green-600"
          asChild
          data-testid="button-whatsapp-contact"
        >
          <a
            href="https://wa.me/37433501500"
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="h-5 w-5" />
            <span>Написать нам</span>
          </a>
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden md:flex h-screen w-64 flex-col border-r bg-sidebar sticky top-0 z-[60]">
        {sidebarContent}
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm md:hidden"
            onClick={onClose}
            data-testid="customer-sidebar-overlay"
          />
          <div className="fixed inset-y-0 left-0 z-[70] w-64 border-r bg-sidebar shadow-lg md:hidden">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}
