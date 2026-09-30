import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Nunito_Sans } from 'next/font/google';
import './globals.css';

const serif = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-serif', display: 'swap' });
const sans = Nunito_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Espaço Cativar Pilates', template: '%s · Espaço Cativar Pilates' },
  description: 'Fisioterapia e Pilates — agenda, evolução e acompanhamento dos pacientes.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf8f3' },
    { media: '(prefers-color-scheme: dark)', color: '#171514' },
  ],
};

// Aplica o tema antes da pintura para evitar "flash" (conteúdo estático, sem dados de usuário).
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${serif.variable} ${sans.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
