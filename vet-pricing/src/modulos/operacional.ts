/**
 * Custos operacionais (indiretos): ocupação do leito, depreciação de equipamentos e mão de obra.
 *
 *   Custo-base do leito/h  = Σ custos fixos mensais ÷ (leitos × horas operacionais × ocupação média)
 *   Custo do leito/h       = custo-base × fator de ponderação da categoria (Geral 1,0; UTI > 1)
 *   Equipamento/h          = [(aquisição − residual) ÷ vida útil + manutenção anual] ÷ (8.760 h × utilização)
 *   Mão de obra/h/paciente = custo-hora do profissional ÷ pacientes por profissional
 *
 * Dividir pela ocupação média faz o paciente internado absorver o custo da ociosidade, que é o
 * comportamento correto para formação de preço (o custo fixo existe com ou sem paciente).
 */
import { HORAS_ANO } from '../constantes';
import { buscarPorId, exigir, exigirFracao, exigirNaoNegativo, exigirPositivo } from '../erros';
import type { CategoriaLeito, ConfigCategoriaLeito, ConfiguracaoClinica, Equipamento, LinhaCustoOperacional, Profissional } from '../tipos';
import { arredondar, brl, dinheiro, num } from '../util/numeros';
import type { UsoEquipamento } from './medicamentos';

export function custoHoraEquipamento(eq: Equipamento): number {
  exigirPositivo(eq.vidaUtilAnos, `equipamento[${eq.id}].vidaUtilAnos`);
  exigirFracao(eq.taxaUtilizacao, `equipamento[${eq.id}].taxaUtilizacao`);
  exigirNaoNegativo(eq.valorAquisicao, `equipamento[${eq.id}].valorAquisicao`);
  exigirNaoNegativo(eq.valorResidual, `equipamento[${eq.id}].valorResidual`);
  exigirNaoNegativo(eq.manutencaoAnual, `equipamento[${eq.id}].manutencaoAnual`);
  exigir(eq.valorResidual <= eq.valorAquisicao, 'VALOR_INVALIDO', `equipamento[${eq.id}]: valor residual maior que o de aquisição.`, 'equipamentos.valorResidual');
  const custoAnual = (eq.valorAquisicao - eq.valorResidual) / eq.vidaUtilAnos + eq.manutencaoAnual;
  return custoAnual / (HORAS_ANO * eq.taxaUtilizacao);
}

export function custoBaseLeitoHora(clinica: ConfiguracaoClinica): { custoHora: number; totalMensal: number } {
  exigirPositivo(clinica.totalLeitos, 'clinica.totalLeitos');
  exigirPositivo(clinica.horasOperacionaisMes, 'clinica.horasOperacionaisMes');
  exigirFracao(clinica.taxaOcupacaoMedia, 'clinica.taxaOcupacaoMedia');
  const totalMensal = clinica.custosFixosMensais.reduce((acc, c) => {
    exigirNaoNegativo(c.valor, `clinica.custosFixosMensais[${c.descricao}]`);
    return acc + c.valor;
  }, 0);
  return { custoHora: totalMensal / (clinica.totalLeitos * clinica.horasOperacionaisMes * clinica.taxaOcupacaoMedia), totalMensal };
}

/** Helper para cadastro: custo-hora a partir de salário, encargos e benefícios. */
export function custoHoraProfissional(p: { salarioMensal: number; encargosPct: number; beneficiosMensais?: number; horasMensais: number }): number {
  exigirPositivo(p.horasMensais, 'horasMensais');
  return arredondar((p.salarioMensal * (1 + p.encargosPct / 100) + (p.beneficiosMensais ?? 0)) / p.horasMensais, 4);
}

export function obterConfigCategoria(clinica: ConfiguracaoClinica, categoria: CategoriaLeito): ConfigCategoriaLeito {
  const config = clinica.categorias[categoria];
  exigir(config, 'CATEGORIA_NAO_CONFIGURADA', `Categoria de leito "${categoria}" não configurada na clínica.`, 'internacao.categoriaLeito');
  exigirPositivo(config.fatorPonderacaoEstrutura, `categorias.${categoria}.fatorPonderacaoEstrutura`);
  return config;
}

export interface ResultadoOperacional {
  leito: LinhaCustoOperacional;
  equipamentos: LinhaCustoOperacional[];
  maoDeObra: LinhaCustoOperacional[];
}

export function calcularCustosOperacionais(params: {
  clinica: ConfiguracaoClinica;
  categoria: CategoriaLeito;
  horas: number;
  equipamentos: ReadonlyMap<string, Equipamento>;
  profissionais: ReadonlyMap<string, Profissional>;
  usosEquipamentos: readonly UsoEquipamento[];
}): ResultadoOperacional {
  const { clinica, categoria, horas } = params;
  const config = obterConfigCategoria(clinica, categoria);
  const base = custoBaseLeitoHora(clinica);
  const custoLeitoHora = base.custoHora * config.fatorPonderacaoEstrutura;

  const leito: LinhaCustoOperacional = {
    descricao: `Ocupação de leito — ${categoria}`,
    horas,
    custoHora: arredondar(custoLeitoHora, 4),
    custoTotal: dinheiro(custoLeitoHora * horas),
    memoriaCalculo:
      `${brl(base.totalMensal)}/mês ÷ (${clinica.totalLeitos} leitos × ${num(clinica.horasOperacionaisMes)} h × ${num(clinica.taxaOcupacaoMedia * 100)}% ocupação) ` +
      `= ${brl(base.custoHora)}/h × fator ${num(config.fatorPonderacaoEstrutura)} × ${num(horas)} h`,
  };

  const linhaEquipamento = (equipamentoId: string, horasUso: number, fracao: number, origem: string, campo: string): LinhaCustoOperacional => {
    const eq = buscarPorId(params.equipamentos, equipamentoId, 'Equipamento', campo);
    const custoHora = custoHoraEquipamento(eq) * fracao;
    return {
      descricao: `${eq.nome} (${origem})`,
      horas: horasUso,
      custoHora: arredondar(custoHora, 4),
      custoTotal: dinheiro(custoHora * horasUso),
      memoriaCalculo:
        `[(${brl(eq.valorAquisicao)} − ${brl(eq.valorResidual)}) ÷ ${num(eq.vidaUtilAnos)} anos + ${brl(eq.manutencaoAnual)}/ano] ÷ ` +
        `(${HORAS_ANO} h × ${num(eq.taxaUtilizacao * 100)}% uso)` +
        (fracao !== 1 ? ` × ${num(fracao)} (fração por leito)` : '') +
        ` × ${num(horasUso)} h`,
    };
  };

  const equipamentos = [
    ...config.equipamentos.map((e) => {
      exigirFracao(e.fracaoUso, `categorias.${categoria}.equipamentos.fracaoUso`);
      return linhaEquipamento(e.equipamentoId, horas, e.fracaoUso, `leito ${categoria}`, `categorias.${categoria}.equipamentos`);
    }),
    ...params.usosEquipamentos.map((u) => linhaEquipamento(u.equipamentoId, u.horas, 1, u.origem, 'prescricoes.equipamentoId')),
  ];

  const maoDeObra = config.equipe.map((e) => {
    exigirPositivo(e.pacientesPorProfissional, `categorias.${categoria}.equipe.pacientesPorProfissional`);
    const prof = buscarPorId(params.profissionais, e.profissionalId, 'Profissional', `categorias.${categoria}.equipe`);
    exigirNaoNegativo(prof.custoHora, `profissional[${prof.id}].custoHora`);
    const custoHora = prof.custoHora / e.pacientesPorProfissional;
    return {
      descricao: prof.funcao,
      horas,
      custoHora: arredondar(custoHora, 4),
      custoTotal: dinheiro(custoHora * horas),
      memoriaCalculo: `${brl(prof.custoHora)}/h ÷ ${num(e.pacientesPorProfissional)} paciente(s) por profissional × ${num(horas)} h`,
    };
  });

  return { leito, equipamentos, maoDeObra };
}
