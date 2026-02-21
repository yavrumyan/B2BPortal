import RegistrationList from '../RegistrationList';

export default function RegistrationListExample() {
  const mockRegistrations = [
    {
      id: '1',
      companyName: 'ООО «Технологии будущего»',
      taxId: '01234567',
      representativeName: 'Иван Петров',
      email: 'ivan@future-tech.am',
      phone: '+374 99 123 456',
      status: 'pending' as const,
      createdAt: '2025-01-10T10:00:00Z',
    },
    {
      id: '2',
      companyName: 'ЗАО «Компьютерные системы»',
      taxId: '12345678',
      representativeName: 'Анна Саркисян',
      email: 'anna@comp-sys.am',
      phone: '+374 98 765 432',
      status: 'approved' as const,
      createdAt: '2025-01-08T14:30:00Z',
    },
  ];

  return (
    <div className="min-h-screen w-full bg-background p-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-4 text-2xl font-bold">Заявки на регистрацию</h1>
        <RegistrationList
          registrations={mockRegistrations}
          onApprove={(id) => console.log('Approve:', id)}
          onReject={(id) => console.log('Reject:', id)}
        />
      </div>
    </div>
  );
}
