export const DOCUMENT_TYPES = [
  'ADM',
  'PDX',
  'DQX',
  'RAN',
  'CRC',
  'OPF',
  'HAU',
  'HAM',
  'HEV',
  'EPI',
  'TAP',
  'FMO',
  'FAC',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export function isValidDocumentType(type: string): type is DocumentType {
  return DOCUMENT_TYPES.includes(type as DocumentType);
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  ADM: 'Documentos administrativos',
  PDX: 'Procedimientos diagnósticos',
  DQX: 'Descripción quirúrgica',
  RAN: 'Registro de anestesia',
  CRC: 'Comprobante de recibido del usuario',
  OPF: 'Orden / prescripción',
  HAU: 'Hoja de atención de urgencias',
  HAM: 'Hoja de administración de medicamentos',
  HEV: 'Hoja de evolución',
  EPI: 'Epicrisis',
  TAP: 'Traslado asistencial de pacientes',
  FMO: 'Factura material de osteosíntesis',
  FAC: 'Factura / cobro aseguradora',
};
