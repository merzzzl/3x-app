// Field names and version markers match AmneziaVPN 5.0.3.0 AwgClientConfig.
export const awg3Fields = [
  'HeaderProtectionKey',
  'ContentPaddingAddition',
  'RekeyAfterTime',
  'RekeyTimeout',
  'RejectAfterTime',
  'KeepaliveTimeout',
  'MaxHandshakeAttempts',
];
export const awgFlags = ['RandomTrailers', 'DisableCookies'];
export const awgFields = [
  'Jc',
  'Jmin',
  'Jmax',
  'S1',
  'S2',
  'S3',
  'S4',
  'H1',
  'H2',
  'H3',
  'H4',
  'I1',
  'I2',
  'I3',
  'I4',
  'I5',
  ...awg3Fields,
  ...awgFlags,
];
export function awgVersion(fields: Record<string, string>) {
  if (
    awg3Fields.some((key) => fields[key]) ||
    awgFlags.some((key) => fields[key] && fields[key].toLowerCase() !== 'off')
  )
    return '3.1';
  if (fields.S3 || fields.S4 || ['H1', 'H2', 'H3', 'H4'].some((key) => fields[key]?.includes('-')))
    return '2';
  return ['I1', 'I2', 'I3', 'I4', 'I5'].some((key) => fields[key]) ? '1.5' : '';
}
