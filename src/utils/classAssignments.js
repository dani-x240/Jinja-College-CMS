export const normalizeClassValue = (value = '') =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const parseAssignedClasses = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => `${item || ''}`.trim()).filter(Boolean);
  }

  return `${value}`
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const stringifyAssignedClasses = (classes = []) => {
  const unique = [...new Set(classes.map((item) => `${item || ''}`.trim()).filter(Boolean))];
  return unique.join(', ');
};

export const classMatches = (candidate = '', assigned = '') => {
  const candidateValue = normalizeClassValue(candidate);
  const assignedValue = normalizeClassValue(assigned);

  if (!candidateValue || !assignedValue) return false;

  return (
    candidateValue === assignedValue ||
    candidateValue.startsWith(`${assignedValue} `) ||
    assignedValue.startsWith(`${candidateValue} `)
  );
};

export const matchesAnyAssignedClass = (candidate = '', assignedClasses = []) =>
  assignedClasses.some((assignedClass) => classMatches(candidate, assignedClass));
