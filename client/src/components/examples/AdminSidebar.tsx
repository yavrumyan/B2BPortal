import { useState } from 'react';
import AdminSidebar from '../AdminSidebar';

export default function AdminSidebarExample() {
  const [activeSection, setActiveSection] = useState<"products" | "registrations" | "orders" | "settings">("products");

  return (
    <div className="flex h-screen w-full bg-background">
      <AdminSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        pendingRegistrationsCount={3}
      />
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold">Active: {activeSection}</h1>
      </div>
    </div>
  );
}
