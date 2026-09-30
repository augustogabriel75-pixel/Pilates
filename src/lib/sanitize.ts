// Sanitização de texto livre (defesa em profundidade contra XSS).
// O React já escapa tudo que é renderizado e nunca usamos dangerouslySetInnerHTML
// com dados de usuário; ainda assim removemos marcação HTML antes de persistir.

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const TAGS = /<\/?[a-z!?][^>]*>/gi;

export function sanitizeText(input: string): string {
  return input
    .normalize('NFC')
    .replace(CONTROL_CHARS, '')
    .replace(TAGS, '')
    .replace(/[<>]/g, '')
    .trim();
}
