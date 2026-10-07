/** Erro de validação/cálculo com código estável (para tradução e tratamento pela API/frontend). */
export class ErroCalculo extends Error {
  readonly codigo: string;
  readonly campo: string | undefined;

  constructor(codigo: string, mensagem: string, campo?: string) {
    super(mensagem);
    this.name = 'ErroCalculo';
    this.codigo = codigo;
    this.campo = campo;
  }
}

export function exigir(condicao: unknown, codigo: string, mensagem: string, campo?: string): asserts condicao {
  if (!condicao) throw new ErroCalculo(codigo, mensagem, campo);
}

export function exigirPositivo(valor: number, campo: string): void {
  exigir(Number.isFinite(valor) && valor > 0, 'VALOR_INVALIDO', `"${campo}" deve ser um número maior que zero (recebido: ${valor}).`, campo);
}

export function exigirNaoNegativo(valor: number, campo: string): void {
  exigir(Number.isFinite(valor) && valor >= 0, 'VALOR_INVALIDO', `"${campo}" deve ser um número maior ou igual a zero (recebido: ${valor}).`, campo);
}

export function exigirFracao(valor: number, campo: string): void {
  exigir(Number.isFinite(valor) && valor > 0 && valor <= 1, 'VALOR_INVALIDO', `"${campo}" deve estar entre 0 (exclusivo) e 1 (recebido: ${valor}).`, campo);
}

/** Busca por ID com erro descritivo. */
export function buscarPorId<T extends { id: string }>(mapa: ReadonlyMap<string, T>, id: string, entidade: string, campo: string): T {
  const item = mapa.get(id);
  exigir(item, 'REFERENCIA_INEXISTENTE', `${entidade} "${id}" não encontrado no catálogo.`, campo);
  return item;
}
