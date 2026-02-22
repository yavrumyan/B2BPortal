import { Package, Users, ShoppingBag, Mail, Settings, X, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logoPath from "@assets/logo.png";

interface AdminSidebarProps {
  activeSection?: "dashboard" | "products" | "registrations" | "orders" | "inquiries" | "settings";
  onSectionChange?: (section: "dashboard" | "products" | "registrations" | "orders" | "inquiries" | "settings") => void;
  pendingRegistrationsCount?: number;
  pendingInquiriesCount?: number;
  unseenOrdersCount?: number;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function AdminSidebar({
  activeSection = "dashboard",
  onSectionChange,
  pendingRegistrationsCount = 0,
  pendingInquiriesCount = 0,
  unseenOrdersCount = 0,
  isOpen = false,
  onClose,
}: AdminSidebarProps) {
  const sections = [
    {
      id: "dashboard" as const,
      label: "Дашборд",
      icon: BarChart2,
    },
    {
      id: "products" as const,
      label: "Товары",
      icon: Package,
    },
    {
      id: "registrations" as const,
      label: "Клиенты",
      icon: Users,
      badge: pendingRegistrationsCount,
    },
    {
      id: "orders" as const,
      label: "Заказы",
      icon: ShoppingBag,
      badge: unseenOrdersCount,
    },
    {
      id: "inquiries" as const,
      label: "Запросы",
      icon: Mail,
      badge: pendingInquiriesCount,
    },
    {
      id: "settings" as const,
      label: "Настройки",
      icon: Settings,
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
            <div className="flex items-center gap-2">
              <div className="text-base font-bold text-black">b2b.chip.am</div>
              <Badge variant="secondary" className="text-xs">Admin</Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onClose}
            data-testid="button-close-admin-sidebar"
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
              data-testid={`button-admin-${section.id}`}
            >
              <Icon className="h-5 w-5" />
              <span>{section.label}</span>
              {section.badge !== undefined && section.badge > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-auto"
                  data-testid={`badge-${section.id}-count`}
                >
                  {section.badge}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden md:flex h-screen w-64 flex-col border-r bg-sidebar">
        {sidebarContent}
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm md:hidden"
            onClick={onClose}
            data-testid="admin-sidebar-overlay"
          />
          <div className="fixed inset-y-0 left-0 z-[70] w-64 border-r bg-sidebar shadow-lg md:hidden">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}
