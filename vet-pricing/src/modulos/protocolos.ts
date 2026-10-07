/**
 * Protocolos de tratamento: modelos reutilizáveis de prescrições + insumos
 * (ex.: "Acesso venoso periférico", "Gastroenterite canina", "Analgesia felina").
 */
import { exigir } from '../erros';
import type { EntradaCalculo, Especie, ProtocoloTratamento } from '../tipos';

export type ItensProtocolo = Pick<EntradaCalculo, 'prescricoes' | 'insumos'> & Partial<Pick<EntradaCalculo, 'fluidoterapia'>>;

/**
 * Combina protocolos em um único conjunto de itens. Se mais de um protocolo definir
 * fluidoterapia, prevalece o último (permite sobrescrever um protocolo-base).
 */
export function combinarProtocolos(protocolos: readonly ProtocoloTratamento[], especie?: Especie): ItensProtocolo {
  const resultado: ItensProtocolo = { prescricoes: [], insumos: [] };
  for (const p of protocolos) {
    exigir(
      !especie || !p.especies || p.especies.includes(especie),
      'PROTOCOLO_INCOMPATIVEL',
      `Protocolo "${p.nome}" não se aplica à espécie ${especie}.`,
      'protocolos',
    );
    resultado.prescricoes.push(...p.prescricoes.map((rx) => ({ ...rx })));
    resultado.insumos.push(...p.insumos.map((i) => ({ ...i })));
    if (p.fluidoterapia) resultado.fluidoterapia = { ...p.fluidoterapia };
  }
  return resultado;
}
