/**
 * Simulação prática: internação de 3 dias de um cão de 25 kg e de um gato de 3,5 kg.
 *
 *   npm run exemplo
 */
import { calculateHospitalizationCost } from '../src/calculadora';
import type { EntradaCalculo, ResultadoCalculo } from '../src/tipos';
import { brl, num } from '../src/util/numeros';
import { entradaCao25kg, entradaGato3_5kg } from './dados-exemplo';

const LARGURA = 96;
const linha = (c = '─') => console.log(c.repeat(LARGURA));
const valor = (rotulo: string, v: number, recuo = 2) => console.log(`${' '.repeat(recuo)}${rotulo.padEnd(56 - recuo, '.')} ${brl(v).padStart(14)}`);

function imprimir(titulo: string, r: ResultadoCalculo): void {
  linha('═');
  console.log(` ${titulo}`);
  console.log(` ${r.paciente.nome} (${r.paciente.especie}, ${num(r.paciente.pesoKg)} kg) — ${r.categoriaLeito}, ${r.duracaoHoras} h (${r.dias} dias)`);
  linha('═');

  console.log('\n MEDICAMENTOS');
  for (const m of r.medicamentos) {
    console.log(`  • ${m.nome}`);
    console.log(
      `    ${m.via} ${m.frequencia} | ${num(m.doseAtivoPorAplicacao.valor)} ${m.doseAtivoPorAplicacao.unidade} = ${num(m.quantidadePorAplicacao)} ${m.unidadeBase}/aplic. × ${m.numeroAplicacoes} | ` +
        `${m.politicaDesperdicio} | ${m.recipientesAbertos} recip. | descarte ${num(m.quantidadeDesperdicada)} ${m.unidadeBase}`,
    );
    console.log(`    usado ${brl(m.custoUtilizado)} + desperdício ${brl(m.custoDesperdicio)} = ${brl(m.custoTotal)}`);
  }

  if (r.fluidoterapia) {
    const f = r.fluidoterapia;
    console.log('\n FLUIDOTERAPIA');
    console.log(`  • ${f.nome}: ${num(f.taxaManutencaoMlH)} mL/h manutenção | total ${num(f.volumeTotalMl)} mL (déficit ${num(f.volumeDeficitMl)} mL, perdas ${num(f.volumePerdasMl)} mL)`);
    console.log(`    ${f.bolsasConsumidas} bolsa(s) de ${f.capacidadeBolsaMl} mL | descarte ${num(f.volumeDesperdicadoMl)} mL | ${brl(f.custoTotal)}`);
  }

  console.log(`\n INSUMOS CONSOLIDADOS (manejos previstos: ${r.manejosPrevistos})`);
  for (const i of r.insumosConsolidados) {
    console.log(`  • ${`${i.nome} — ${num(i.quantidade)} ${i.unidade}`.padEnd(70)} ${brl(i.custoTotal).padStart(14)}`);
  }

  console.log('\n CUSTOS OPERACIONAIS');
  for (const o of [r.operacional.leito, ...r.operacional.equipamentos, ...r.operacional.maoDeObra]) {
    console.log(`  • ${`${o.descricao} — ${brl(o.custoHora)}/h × ${num(o.horas)} h`.padEnd(70)} ${brl(o.custoTotal).padStart(14)}`);
  }

  const s = r.resumo;
  console.log('\n RESUMO FINANCEIRO');
  linha();
  valor('Medicamentos', s.custoMedicamentos);
  valor('Fluidoterapia', s.custoFluidoterapia);
  valor('Insumos', s.custoInsumos);
  valor('Margem de segurança (imprevistos/perdas)', s.margemSeguranca.total);
  valor('CUSTO DIRETO', s.custoDireto, 1);
  valor('Leito (rateio de custos fixos)', s.custoLeito);
  valor('Equipamentos (depreciação + manutenção)', s.custoEquipamentos);
  valor('Mão de obra', s.custoMaoDeObra);
  valor('CUSTO INDIRETO', s.custoIndireto, 1);
  linha();
  valor('CUSTO TOTAL', s.custoTotal, 1);
  valor(`Lucro (${num(r.resumo.markupSobreCustoPct)}% markup final)`, s.lucro);
  valor(`Impostos (${num(s.aliquotaImpostosPct)}%)`, s.impostos);
  valor(`Taxa de pagamento (${num(s.taxaPagamentoPct)}%)`, s.taxaPagamento);
  linha();
  valor('PREÇO FINAL SUGERIDO', s.precoFinal, 1);
  valor('Diária sugerida', s.precoDiaria, 1);
  console.log(`  Margem líquida sobre o preço: ${num(s.margemLiquidaSobrePrecoPct)}%`);

  console.log('\n PREÇO POR FORMA DE PAGAMENTO');
  for (const p of r.tabelaFormasPagamento) {
    const rotulo =
      p.tipo !== 'CREDITO' ? p.tipo
      : p.parcelas === 1 ? 'Crédito à vista'
      : `Crédito ${p.parcelas}x (1ª ${brl(p.valorPrimeiraParcela)} + ${p.parcelas - 1}× ${brl(p.valorParcela)})`;
    console.log(`  • ${rotulo.padEnd(48)} taxa ${`${num(p.taxaPct)}%`.padStart(6)}   ${brl(p.precoFinal).padStart(14)}`);
  }

  if (r.alertas.length) {
    console.log('\n ALERTAS');
    for (const a of r.alertas) console.log(`  [${a.nivel}] ${a.mensagem}`);
  }
  console.log();
}

const cao = calculateHospitalizationCost(entradaCao25kg);
imprimir('CENÁRIO 1 — Cão 25 kg | Internação Geral + fluidoterapia + 3 injetáveis + 4 cateteres', cao);

const gato = calculateHospitalizationCost(entradaGato3_5kg);
imprimir('CENÁRIO 2 — Gato 3,5 kg | Semi-intensiva + microdoses + desperdício de ampolas', gato);

// Impacto da política de desperdício no gato: mesma prescrição, cobrando só a fração usada.
const gatoFracionado: EntradaCalculo = {
  ...entradaGato3_5kg,
  prescricoes: entradaGato3_5kg.prescricoes.map((rx) => ({ ...rx, politicaDesperdicio: 'FRACIONADO' as const })),
};
const comparativo = calculateHospitalizationCost(gatoFracionado);
linha('═');
console.log(' IMPACTO DO DESPERDÍCIO DE AMPOLAS (gato)');
linha('═');
valor('Medicamentos — ampola inteira descartada', gato.resumo.custoMedicamentos);
valor('Medicamentos — somente fração utilizada', comparativo.resumo.custoMedicamentos);
valor('Diferença no preço final', gato.resumo.precoFinal - comparativo.resumo.precoFinal);
console.log();
