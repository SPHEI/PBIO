interface HomeProps {
  message: string;
}

export function Home({ message }: HomeProps) {
  return (
    <div>
      <h1>Welcome to My Notes App</h1>
      <p>Backend Status: <strong>{message}</strong></p>
      <p>Use the navigation bar above to log in, register a new account, or inspect database users.</p>
    </div>
  );
}