import { BusinessRegistration } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Save, ChevronDown, Trash2, Download } from "lucide-react";
import { useState } from "react";
import { CUSTOMER_TYPES, getCustomerTypeLabel } from "@shared/utils";
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

interface CustomerStats {
  totalOrders?: number;
  totalAmount?: number;
  overdueAmount?: number;
}

interface RegistrationListProps {
  registrations: (BusinessRegistration & CustomerStats)[];
  onApprove?: (id: string, customerType: string) => void;
  onReject?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<BusinessRegistration>) => void;
  onDelete?: (id: string) => void;
}

export default function RegistrationList({
  registrations,
  onApprove,
  onReject,
  onUpdate,
  onDelete,
}: RegistrationListProps) {
  const [editedFields, setEditedFields] = useState<Record<string, Partial<BusinessRegistration>>>({});
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedCustomers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredRegistrations = registrations.filter((registration) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      registration.companyName.toLowerCase().includes(searchLower) ||
      registration.taxId.toLowerCase().includes(searchLower) ||
      registration.email.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-600 text-white">Pending</Badge>;
      case "approved":
        return <Badge className="bg-green-600 text-white">Approved</Badge>;
      case "limited":
        return <Badge className="bg-orange-600 text-white">Limited</Badge>;
      case "paused":
        return <Badge className="bg-red-600 text-white">Paused</Badge>;
      case "rejected":
        return <Badge variant="destructive">Declined</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleFieldChange = (id: string, field: keyof BusinessRegistration, value: any) => {
    setEditedFields((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const getEditedValue = (id: string, field: keyof BusinessRegistration, defaultValue: any) => {
    return editedFields[id]?.[field] ?? defaultValue;
  };

  const handleSave = (id: string) => {
    if (editedFields[id] && onUpdate) {
      onUpdate(id, editedFields[id]);
      setEditedFields((prev) => {
        const newFields = { ...prev };
        delete newFields[id];
        return newFields;
      });
    }
  };

  return (
    <div className="space-y-4">
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить клиента?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие невозможно отменить. Все данные клиента и его заказы будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId) {
                  onDelete?.(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div>
        <Input
          placeholder="Поиск по названию компании, ИНН или email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-4"
          data-testid="input-search-customers"
        />
      </div>
      {filteredRegistrations.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          {searchTerm ? "Клиенты не найдены" : "Нет клиентов"}
        </div>
      ) : (
        filteredRegistrations.map((registration) => {
          const isExpanded = expandedCustomers[registration.id];
          return (
            <Card key={registration.id} data-testid={`registration-card-${registration.id}`}>
              <CardContent className="p-4">
                {/* Collapsed Header View */}
                <div
                  className="flex items-center justify-between gap-2 cursor-pointer hover-elevate p-2 -m-2 rounded-md"
                  onClick={() => toggleExpanded(registration.id)}
                  data-testid={`header-${registration.id}`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                    <span className="font-medium">{registration.companyName}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {getStatusBadge(registration.status)}
                    <div className="text-sm">
                      <span className={`font-medium ${(registration.overdueAmount ?? 0) > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {registration.overdueAmount?.toLocaleString() ?? 0} ֏
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details View */}
                {isExpanded && (
                  <div className="space-y-4 mt-4 pt-4 border-t">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-32">Компания:</span>
                          <Input
                            value={getEditedValue(registration.id, "companyName", registration.companyName)}
                            onChange={(e) => handleFieldChange(registration.id, "companyName", e.target.value)}
                            className="flex-1"
                            data-testid={`input-company-${registration.id}`}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-32">ИНН:</span>
                          <Input
                            value={getEditedValue(registration.id, "taxId", registration.taxId)}
                            onChange={(e) => handleFieldChange(registration.id, "taxId", e.target.value)}
                            className="flex-1"
                            data-testid={`input-taxid-${registration.id}`}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-32">Представитель:</span>
                          <Input
                            value={getEditedValue(registration.id, "representativeName", registration.representativeName)}
                            onChange={(e) => handleFieldChange(registration.id, "representativeName", e.target.value)}
                            className="flex-1"
                            data-testid={`input-representative-${registration.id}`}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-32">Email:</span>
                          <Input
                            value={registration.email}
                            disabled
                            className="flex-1 bg-muted"
                            data-testid={`input-email-${registration.id}`}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-32">Телефон:</span>
                          <Input
                            value={getEditedValue(registration.id, "phone", registration.phone)}
                            onChange={(e) => handleFieldChange(registration.id, "phone", e.target.value)}
                            className="flex-1"
                            data-testid={`input-phone-${registration.id}`}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-32">Адрес:</span>
                          <Input
                            value={getEditedValue(registration.id, "deliveryAddress", registration.deliveryAddress || "")}
                            onChange={(e) => handleFieldChange(registration.id, "deliveryAddress", e.target.value)}
                            className="flex-1"
                            data-testid={`input-address-${registration.id}`}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-32">Банк:</span>
                          <Input
                            value={getEditedValue(registration.id, "bankName", registration.bankName || "")}
                            onChange={(e) => handleFieldChange(registration.id, "bankName", e.target.value)}
                            className="flex-1"
                            data-testid={`input-bank-${registration.id}`}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-32">Счет:</span>
                          <Input
                            value={getEditedValue(registration.id, "bankAccount", registration.bankAccount || "")}
                            onChange={(e) => handleFieldChange(registration.id, "bankAccount", e.target.value)}
                            className="flex-1"
                            data-testid={`input-account-${registration.id}`}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-32">Статус:</span>
                          <Select
                            value={getEditedValue(registration.id, "status", registration.status)}
                            onValueChange={(value) => handleFieldChange(registration.id, "status", value)}
                          >
                            <SelectTrigger className="flex-1" data-testid={`select-status-${registration.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="limited">Limited</SelectItem>
                              <SelectItem value="paused">Paused</SelectItem>
                              <SelectItem value="rejected">Declined</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-32">Тип аккаунта:</span>
                          <Select
                            value={getEditedValue(registration.id, "customerType", registration.customerType || CUSTOMER_TYPES.RESELLER)}
                            onValueChange={(value) => handleFieldChange(registration.id, "customerType", value)}
                          >
                            <SelectTrigger className="flex-1" data-testid={`select-customer-type-${registration.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={CUSTOMER_TYPES.RESELLER}>Дилер</SelectItem>
                              <SelectItem value={CUSTOMER_TYPES.CORPORATE}>Корпоративный</SelectItem>
                              <SelectItem value={CUSTOMER_TYPES.GOVERNMENT}>Гос. учреждение</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-32">Мессенджер:</span>
                          <Select
                            value={getEditedValue(registration.id, "messenger", registration.messenger)}
                            onValueChange={(value) => handleFieldChange(registration.id, "messenger", value)}
                          >
                            <SelectTrigger className="flex-1" data-testid={`select-messenger-${registration.id}`}>
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
                          <span className="text-sm text-muted-foreground w-32">Контакт в мессенджере:</span>
                          <Input
                            value={getEditedValue(registration.id, "messengerContact", registration.messengerContact || "")}
                            onChange={(e) => handleFieldChange(registration.id, "messengerContact", e.target.value)}
                            className="flex-1"
                            data-testid={`input-messenger-contact-${registration.id}`}
                          />
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Подано: {registration.createdAt ? new Date(registration.createdAt).toLocaleDateString("ru-RU") : "—"}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {getStatusBadge(registration.status)}

                        {registration.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => onApprove?.(registration.id, getEditedValue(registration.id, "customerType", registration.customerType || CUSTOMER_TYPES.RESELLER))}
                              className="bg-green-600 hover:bg-green-700"
                              data-testid={`button-approve-${registration.id}`}
                            >
                              <Check className="h-4 w-4 sm:mr-2" />
                              <span className="hidden sm:inline">Одобрить</span>
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => onReject?.(registration.id)}
                              data-testid={`button-reject-${registration.id}`}
                            >
                              <X className="h-4 w-4 sm:mr-2" />
                              <span className="hidden sm:inline">Отклонить</span>
                            </Button>
                          </div>
                        )}

                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleSave(registration.id)}
                          data-testid={`button-save-${registration.id}`}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          SAVE
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/api/customers/${registration.id}/price-list/pdf`, "_blank")}
                          data-testid={`button-price-list-${registration.id}`}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Прайс PDF
                        </Button>

                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteConfirmId(registration.id)}
                          data-testid={`button-delete-customer-${registration.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Удалить
                        </Button>
                      </div>
                    </div>
                    {/* Display order statistics if available */}
                    {typeof registration.totalOrders === 'number' && (
                      <div className="mt-4 border-t pt-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Количество заказов:</span>
                          <span className="font-medium">{registration.totalOrders}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Сумма всех заказов:</span>
                          <span className="font-medium">{registration.totalAmount?.toLocaleString() ?? 0} ֏</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Просроченные платежи:</span>
                          <span className={`font-medium ${(registration.overdueAmount ?? 0) > 0 ? 'text-red-600' : ''}`}>
                            {registration.overdueAmount?.toLocaleString() ?? 0} ֏
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}