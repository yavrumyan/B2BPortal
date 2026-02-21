import { useQuery } from "@tanstack/react-query";
import type { Customer } from "@shared/schema";

export function useAuth() {
  const { data: customer, isLoading } = useQuery<Omit<Customer, 'password'>>({
    queryKey: ["/api/auth/me"],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    customer,
    isLoading,
    isAuthenticated: !!customer,
    isAdmin: customer?.role === 'admin',
  };
}
