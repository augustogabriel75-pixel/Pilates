'use client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-semibold">Algo deu errado</h1>
      <p className="text-mist-500">Não foi possível carregar esta página. Tente novamente.</p>
      <button onClick={reset} className="btn-primary">Tentar novamente</button>
    </div>
  );
}
