import Header from '../Header';

export default function HeaderExample() {
  return (
    <Header
      cartItemCount={3}
      onCartClick={() => console.log('Cart clicked')}
      onLoginClick={() => console.log('Login clicked')}
      isLoggedIn={false}
    />
  );
}
