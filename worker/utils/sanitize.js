export function sanitizeString(value, maxLength = 2000) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[<>]/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeAnswers(answers) {
  if (!Array.isArray(answers)) return [];
  return answers.map((a) => ({
    id: sanitizeString(a.id, 64),
    type: sanitizeString(a.type, 32),
    label: sanitizeString(a.label, 256),
    value: sanitizeAnswerValue(a),
    required: !!a.required,
    min: a.min,
    max: a.max,
    options: a.options,
  }));
}

function sanitizeAnswerValue(answer) {
  switch (answer.type) {
    case 'rating':
      return Math.max(1, Math.min(10, parseInt(answer.value) || 0));
    case 'text':
    case 'textarea':
    case 'email':
    case 'phone':
    case 'url':
      return sanitizeString(String(answer.value || ''), 2000);
    case 'number': {
      const num = Number(answer.value);
      return isNaN(num) ? '' : num;
    }
    case 'select':
    case 'dropdown':
      return sanitizeString(String(answer.value || ''), 256);
    case 'checkboxes':
      return Array.isArray(answer.value)
        ? answer.value.map((v) => sanitizeString(String(v), 256))
        : [];
    case 'yesno': {
      const v = String(answer.value).toLowerCase();
      return v === 'yes' || v === 'true' ? 'Yes' : 'No';
    }
    default:
      return sanitizeString(String(answer.value || ''), 256);
  }
}

export function formatDiscordValue(answer) {
  switch (answer.type) {
    case 'rating': {
      const num = Number(answer.value);
      if (isNaN(num)) return String(answer.value);
      const clamped = Math.max(1, Math.min(10, num));
      const stars = '\u2605'.repeat(Math.min(clamped, 5)) + '\u2606'.repeat(Math.max(0, 5 - Math.min(clamped, 5)));
      return `${stars} (${clamped})`;
    }
    case 'yesno':
      return answer.value;
    case 'checkboxes':
      if (Array.isArray(answer.value) && answer.value.length > 0) {
        return answer.value.map((v) => '\u2022 ' + v).join('\n');
      }
      return 'None selected';
    case 'heading':
    case 'markdown':
    case 'divider':
      return '';
    default:
      return String(answer.value);
  }
}

export function formatDate(timestamp) {
  const d = new Date(timestamp);
  return d.toISOString();
}
