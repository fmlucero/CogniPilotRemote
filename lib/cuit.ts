// Validación liviana de CUIT: 11 dígitos, con o sin guiones.
// Se descartó la verificación de dígito por algoritmo módulo 11 porque rechazaba
// CUITs reales que el usuario quería registrar — la unicidad y el formato bastan.

export function normalizeCuit(input: string): string {
  return input.replace(/\D/g, "").slice(0, 11);
}

export function formatCuit(cuit: string): string {
  const n = normalizeCuit(cuit);
  if (n.length !== 11) return cuit;
  return `${n.slice(0, 2)}-${n.slice(2, 10)}-${n.slice(10)}`;
}

export function isValidCuit(input: string): boolean {
  return normalizeCuit(input).length === 11;
}

/**
 * Formatea progresivamente lo que el usuario va tipeando.
 * Útil en `onChange` del input: deja XX, XX-XXXXXXXX, o XX-XXXXXXXX-X según haya escrito.
 */
export function formatCuitProgressive(input: string): string {
  const n = normalizeCuit(input);
  if (n.length <= 2) return n;
  if (n.length <= 10) return `${n.slice(0, 2)}-${n.slice(2)}`;
  return `${n.slice(0, 2)}-${n.slice(2, 10)}-${n.slice(10)}`;
}
