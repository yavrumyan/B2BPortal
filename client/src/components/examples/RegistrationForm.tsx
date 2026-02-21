import RegistrationForm from '../RegistrationForm';

export default function RegistrationFormExample() {
  return (
    <div className="min-h-screen w-full bg-background">
      <RegistrationForm
        onSubmit={(data) => console.log('Registration submitted:', data)}
      />
    </div>
  );
}
