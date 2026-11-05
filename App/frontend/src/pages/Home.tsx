interface HomeProps {
  message: string;
}

export function Home({ message }: HomeProps) {
  return (
    <div>
      <h1><strong>Budżeter Pro Max</strong></h1>
      <p>Backend Status: <strong>{message}</strong></p>
    </div>
  );
}