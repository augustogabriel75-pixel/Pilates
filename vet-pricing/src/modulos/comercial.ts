/**
 * Formação do preço de venda.
 *
 * Impostos e taxas de cartão incidem sobre o PREÇO (receita), não sobre o custo; por isso o
 * preço é obtido por "gross-up" (divisor), e não somando percentuais ao custo:
 *
 *   SOBRE_CUSTO (markup, padrão):  P = C × (1 + m) ÷ (1 − t − f)    → lucro = C × m
 *   SOBRE_PRECO (margem líquida):  P = C ÷ (1 − t − f − m)          → lucro = P × m
 *
 *   C = custo total, m = margem, t = alíquota de impostos, f = taxa da forma de pagamento.
 *
 * Somar percentuais ao custo (C × (1 + m + t + f)) subprecifica: o imposto calculado sobre o
 * preço final seria maior do que o valor reservado para ele.
 */
import { ErroCalculo, exigir, exigirNaoNegativo } from '../erros';
import type { FormaPagamento, ModoMargem, ParametrosComerciais, PrecoPorFormaPagamento, TabelaTaxasPagamento } from '../tipos';
import { deCentavos, paraCentavos, pct } from '../util/numeros';

export function taxaDaFormaPagamento(forma: FormaPagamento, tabela: TabelaTaxasPagamento): number {
  switch (forma.tipo) {
    case 'DINHEIRO':
      return 0;
    case 'PIX':
      return tabela.pixPct ?? 0;
    case 'DEBITO':
      return tabela.debitoPct;
    case 'CREDITO': {
      const parcelas = forma.parcelas ?? 1;
      const taxa = tabela.creditoPorParcelasPct[parcelas];
      exigir(taxa !== undefined, 'PARCELAMENTO_INDISPONIVEL', `Sem taxa cadastrada para crédito em ${parcelas}x.`, 'comercial.formaPagamento.parcelas');
      return taxa;
    }
    default:
      throw new ErroCalculo('FORMA_PAGAMENTO_INVALIDA', `Forma de pagamento desconhecida: ${String((forma as FormaPagamento).tipo)}.`, 'comercial.formaPagamento');
  }
}

export function aliquotaTotalImpostos(params: ParametrosComerciais): number {
  return params.impostos.reduce((acc, i) => {
    exigirNaoNegativo(i.aliquotaPct, `comercial.impostos[${i.nome}].aliquotaPct`);
    return acc + i.aliquotaPct;
  }, 0);
}

export interface ResultadoPreco {
  precoFinal: number;
  impostos: number;
  taxaPagamento: number;
  lucro: number;
}

export function calcularPrecoVenda(custoTotal: number, impostosPct: number, taxaPct: number, margemPct: number, modo: ModoMargem): ResultadoPreco {
  exigirNaoNegativo(custoTotal, 'custoTotal');
  exigirNaoNegativo(margemPct, 'comercial.margemLucroPct');
  exigirNaoNegativo(taxaPct, 'taxaPagamentoPct');
  const t = pct(impostosPct);
  const f = pct(taxaPct);
  const m = pct(margemPct);
  const divisor = modo === 'SOBRE_CUSTO' ? 1 - t - f : 1 - t - f - m;
  exigir(
    divisor > 0,
    'PERCENTUAIS_INVIAVEIS',
    `Impostos (${impostosPct}%) + taxa (${taxaPct}%)${modo === 'SOBRE_PRECO' ? ` + margem (${margemPct}%)` : ''} somam 100% ou mais: não há preço que cubra o custo.`,
    'comercial',
  );

  const custoC = paraCentavos(custoTotal);
  const precoC = Math.round((modo === 'SOBRE_CUSTO' ? custoC * (1 + m) : custoC) / divisor);
  const impostosC = Math.round(precoC * t);
  const taxaC = Math.round(precoC * f);
  return {
    precoFinal: deCentavos(precoC),
    impostos: deCentavos(impostosC),
    taxaPagamento: deCentavos(taxaC),
    lucro: deCentavos(precoC - custoC - impostosC - taxaC),
  };
}

/** Preço para todas as formas de pagamento cadastradas (para exibir ao tutor). */
export function gerarTabelaFormasPagamento(custoTotal: number, params: ParametrosComerciais): PrecoPorFormaPagamento[] {
  const impostosPct = aliquotaTotalImpostos(params);
  const modo = params.modoMargem ?? 'SOBRE_CUSTO';
  const formas: FormaPagamento[] = [
    { tipo: 'PIX' },
    { tipo: 'DINHEIRO' },
    { tipo: 'DEBITO' },
    ...Object.keys(params.taxasPagamento.creditoPorParcelasPct)
      .map(Number)
      .sort((a, b) => a - b)
      .map((parcelas): FormaPagamento => ({ tipo: 'CREDITO', parcelas })),
  ];
  return formas.map((forma) => {
    const taxaPct = taxaDaFormaPagamento(forma, params.taxasPagamento);
    const { precoFinal } = calcularPrecoVenda(custoTotal, impostosPct, taxaPct, params.margemLucroPct, modo);
    const parcelas = forma.parcelas ?? 1;
    const precoC = paraCentavos(precoFinal);
    const parcelaC = Math.floor(precoC / parcelas);
    return {
      tipo: forma.tipo,
      parcelas,
      taxaPct,
      precoFinal,
      valorParcela: deCentavos(parcelaC),
      valorPrimeiraParcela: deCentavos(precoC - parcelaC * (parcelas - 1)),
    };
  });
}
