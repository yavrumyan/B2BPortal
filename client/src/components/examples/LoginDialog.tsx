import { useState } from 'react';
import LoginDialog from '../LoginDialog';
import { Button } from '@/components/ui/button';

export default function LoginDialogExample() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Button onClick={() => setIsOpen(true)}>Open Login</Button>
      <LoginDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onLogin={(data) => console.log('Login:', data)}
        onRegisterClick={() => console.log('Register clicked')}
      />
    </div>
  );
}
