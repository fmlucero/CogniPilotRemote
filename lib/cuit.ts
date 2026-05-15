// Validación de CUIT argentino (11 dígitos + dígito verificador módulo 11).
// Acepta entrada con o sin guiones: "30-71234567-8" o "30712345678".

const MULTIPLIERS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export function normalizeCuit(input: string): string {
  return input.replace(/[-\s]/g, "");
}

export function formatCuit(cuit: string): string {
  const n = normalizeCuit(cuit);
  if (n.length !== 11) return cuit;
  return `${n.slice(0, 2)}-${n.slice(2, 10)}-${n.slice(10)}`;
}

export function isValidCuit(input: string): boolean {
  const n = normalizeCuit(input);
  if (!/^\d{11}$/.test(n)) return false;

  const digits = n.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += digits[i] * MULTIPLIERS[i];
  const mod = sum % 11;
  let check = 11 - mod;
  if (check === 11) check = 0;
  else if (check === 10) return false; // CUITs con dv=10 no son válidos
  return check === digits[10];
}
