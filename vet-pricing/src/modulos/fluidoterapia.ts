/**
 * Módulo de fluidoterapia.
 *
 *   Manutenção (mL/h)      = taxa (mL/kg/h) × peso (kg)
 *   Déficit (mL)           = % desidratação × peso (kg) × 10   [= % × peso × 1000 mL ÷ 100]
 *                            reposto linearmente em `horasCorrecaoDeficit`
 *   Perdas contínuas (mL/h)= perdas (mL/dia) ÷ 24
 *
 * O consumo é simulado hora a hora contra as bolsas: cada bolsa aberta vale por
 * `validadeAposAbertoHoras` (padrão 24 h); o saldo de uma bolsa vencida é descartado.
 */
import {
  HORAS_CORRECAO_DEFICIT_PADRAO,
  PASSO_SIMULACAO_FLUIDO_HORAS,
  TROCA_EQUIPO_HORAS_PADRAO,
  VALIDADE_BOLSA_FLUIDO_HORAS_PADRAO,
} from '../constantes';
import { exigir, exigirNaoNegativo, exigirPositivo } from '../erros';
import type { Insumo, LinhaFluidoterapia, PrescricaoFluidoterapia } from '../tipos';
import { EPSILON, arredondar, num, tetoSeguro } from '../util/numeros';
import type { ConsumoInsumoOrigem, UsoEquipamento } from './medicamentos';
import { custosEmCentavos, simularConsumoRecipientes, type EventoConsumo } from './recipientes';

export interface ResultadoFluidoterapia {
  linha: LinhaFluidoterapia;
  consumoInsumos: ConsumoInsumoOrigem[];
  usoEquipamentos: UsoEquipamento[];
  horasTrocaBolsa: number[];
}

export function calcularFluidoterapia(
  prescricao: PrescricaoFluidoterapia,
  bolsa: Insumo,
  ctx: { pesoKg: number; duracaoInternacaoHoras: number },
): ResultadoFluidoterapia {
  exigir(bolsa.capacidadeMl && bolsa.capacidadeMl > 0, 'CADASTRO_INCOMPLETO', `Insumo "${bolsa.id}" precisa de capacidadeMl para ser usado como bolsa de fluido.`, 'fluidoterapia.solucaoInsumoId');
  exigirNaoNegativo(prescricao.taxaManutencaoMlKgH, 'fluidoterapia.taxaManutencaoMlKgH');
  const deficitPct = prescricao.deficitDesidratacaoPct ?? 0;
  exigir(deficitPct >= 0 && deficitPct <= 20, 'VALOR_INVALIDO', 'fluidoterapia.deficitDesidratacaoPct deve estar entre 0 e 20%.', 'fluidoterapia.deficitDesidratacaoPct');
  const perdasMlDia = prescricao.perdasContinuasMlDia ?? 0;
  exigirNaoNegativo(perdasMlDia, 'fluidoterapia.perdasContinuasMlDia');
  const horasCorrecao = prescricao.horasCorrecaoDeficit ?? HORAS_CORRECAO_DEFICIT_PADRAO;
  exigirPositivo(horasCorrecao, 'fluidoterapia.horasCorrecaoDeficit');
  const trocaEquipo = prescricao.trocaEquipoHoras ?? TROCA_EQUIPO_HORAS_PADRAO;
  exigirPositivo(trocaEquipo, 'fluidoterapia.trocaEquipoHoras');

  const inicio = prescricao.inicioHora ?? 0;
  exigir(inicio >= 0 && inicio < ctx.duracaoInternacaoHoras, 'JANELA_INVALIDA', 'fluidoterapia.inicioHora fora do período de internação.', 'fluidoterapia.inicioHora');
  const fim = Math.min(inicio + (prescricao.duracaoHoras ?? ctx.duracaoInternacaoHoras), ctx.duracaoInternacaoHoras);
  const horas = fim - inicio;

  const manutencaoMlH = prescricao.taxaManutencaoMlKgH * ctx.pesoKg;
  const perdasMlH = perdasMlDia / 24;
  const deficitTotalMl = deficitPct * ctx.pesoKg * 10;
  const deficitMlH = deficitTotalMl / horasCorrecao;
  const fimCorrecao = inicio + horasCorrecao;

  // Linha do tempo hora a hora (último passo pode ser fracionário).
  const eventos: EventoConsumo[] = [];
  for (let h = inicio; h < fim - EPSILON; h += PASSO_SIMULACAO_FLUIDO_HORAS) {
    const passo = Math.min(PASSO_SIMULACAO_FLUIDO_HORAS, fim - h);
    const horasComDeficit = Math.max(0, Math.min(h + passo, fimCorrecao) - h);
    eventos.push({ hora: h, quantidade: (manutencaoMlH + perdasMlH) * passo + deficitMlH * horasComDeficit });
  }

  const volumeManutencaoMl = manutencaoMlH * horas;
  const volumePerdasMl = perdasMlH * horas;
  const volumeDeficitMl = deficitMlH * Math.min(horas, horasCorrecao);

  const consumo = simularConsumoRecipientes(
    eventos,
    {
      capacidade: bolsa.capacidadeMl,
      precoCusto: bolsa.custoUnitario,
      validadeAposAbertoHoras: bolsa.validadeAposAbertoHoras ?? VALIDADE_BOLSA_FLUIDO_HORAS_PADRAO,
    },
    'POR_ESTABILIDADE',
  );

  const memoria = [
    `Manutenção: ${num(prescricao.taxaManutencaoMlKgH)} mL/kg/h × ${num(ctx.pesoKg)} kg = ${num(arredondar(manutencaoMlH, 2))} mL/h × ${num(horas)} h = ${num(arredondar(volumeManutencaoMl, 1))} mL`,
  ];
  if (deficitTotalMl > 0) {
    memoria.push(
      `Déficit: ${num(deficitPct)}% × ${num(ctx.pesoKg)} kg × 10 = ${num(arredondar(deficitTotalMl, 1))} mL em ${num(horasCorrecao)} h` +
        (horasCorrecao > horas ? ` (apenas ${num(arredondar(volumeDeficitMl, 1))} mL dentro do período)` : ''),
    );
  }
  if (perdasMlDia > 0) memoria.push(`Perdas contínuas: ${num(perdasMlDia)} mL/dia × ${num(horas / 24)} dia(s) = ${num(arredondar(volumePerdasMl, 1))} mL`);
  memoria.push(
    `Bolsas de ${num(bolsa.capacidadeMl)} mL (validade aberta ${num(bolsa.validadeAposAbertoHoras ?? VALIDADE_BOLSA_FLUIDO_HORAS_PADRAO)} h): ` +
      `${consumo.recipientesAbertos} aberta(s) nas horas [${consumo.horasAbertura.map((x) => num(x)).join(', ')}], ` +
      `descarte de ${num(arredondar(consumo.quantidadeDesperdicada, 1))} mL`,
  );

  const equipos = tetoSeguro(horas / trocaEquipo);

  return {
    linha: {
      solucaoInsumoId: bolsa.id,
      nome: bolsa.nome,
      taxaManutencaoMlH: arredondar(manutencaoMlH, 2),
      volumeManutencaoMl: arredondar(volumeManutencaoMl, 1),
      volumeDeficitMl: arredondar(volumeDeficitMl, 1),
      volumePerdasMl: arredondar(volumePerdasMl, 1),
      volumeTotalMl: arredondar(consumo.quantidadeUtilizada, 1),
      volumeMedioDiarioMl: arredondar((consumo.quantidadeUtilizada / horas) * 24, 1),
      capacidadeBolsaMl: bolsa.capacidadeMl,
      bolsasConsumidas: consumo.recipientesAbertos,
      volumeDesperdicadoMl: arredondar(consumo.quantidadeDesperdicada, 1),
      ...custosEmCentavos(consumo),
      memoriaCalculo: memoria,
    },
    consumoInsumos: [
      {
        insumoId: prescricao.equipoInsumoId,
        quantidade: equipos,
        origem: 'Fluidoterapia',
        memoria: `⌈${num(horas)} h ÷ troca a cada ${num(trocaEquipo)} h⌉ = ${equipos}`,
      },
    ],
    usoEquipamentos: prescricao.bombaInfusaoId ? [{ equipamentoId: prescricao.bombaInfusaoId, horas, origem: 'Fluidoterapia' }] : [],
    horasTrocaBolsa: consumo.horasAbertura,
  };
}
