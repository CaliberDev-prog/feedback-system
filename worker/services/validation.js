export function validateSubmission(body) {
  if (!body || typeof body !== 'object') {
    return 'Invalid submission data.';
  }

  const answers = Array.isArray(body.answers) ? body.answers : [];
  if (answers.length === 0) {
    return 'No answers provided.';
  }

  for (const answer of answers) {
    const error = validateAnswer(answer);
    if (error) return error;
  }

  return null;
}

function validateAnswer(answer) {
  if (!answer.id || !answer.type) {
    return 'Answer missing id or type.';
  }

  switch (answer.type) {
    case 'rating': {
      const val = parseInt(answer.value);
      if (isNaN(val) || val < 1 || val > 10) {
        return `Invalid rating value for "${answer.label || answer.id}".`;
      }
      break;
    }
    case 'text':
    case 'textarea':
    case 'email':
    case 'phone':
    case 'url': {
      const str = String(answer.value || '');
      const maxLen = answer.maxLength || 2000;
      if (str.length > maxLen) {
        return `"${answer.label || answer.id}" exceeds maximum length.`;
      }
      if (answer.type === 'email' && str && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
        return `Invalid email format for "${answer.label || answer.id}".`;
      }
      if (answer.type === 'url' && str) {
        try { new URL(str); } catch { return `Invalid URL for "${answer.label || answer.id}".`; }
      }
      if (answer.required && !str) {
        return `"${answer.label || answer.id}" is required.`;
      }
      break;
    }
    case 'number': {
      const num = Number(answer.value);
      if (answer.required && (answer.value === '' || answer.value === undefined || answer.value === null)) {
        return `"${answer.label || answer.id}" is required.`;
      }
      if (answer.value !== '' && answer.value !== undefined && answer.value !== null && isNaN(num)) {
        return `"${answer.label || answer.id}" must be a valid number.`;
      }
      if (!isNaN(num)) {
        if (answer.min !== undefined && num < answer.min) return `"${answer.label || answer.id}" must be at least ${answer.min}.`;
        if (answer.max !== undefined && num > answer.max) return `"${answer.label || answer.id}" must be at most ${answer.max}.`;
      }
      break;
    }
    case 'select':
    case 'dropdown': {
      if (answer.required && !answer.value) {
        return `"${answer.label || answer.id}" is required.`;
      }
      break;
    }
    case 'checkboxes': {
      if (answer.required && (!Array.isArray(answer.value) || answer.value.length === 0)) {
        return `Please select at least one option for "${answer.label || answer.id}".`;
      }
      break;
    }
    case 'yesno': {
      if (answer.required && !answer.value) {
        return `"${answer.label || answer.id}" is required.`;
      }
      break;
    }
    case 'divider':
    case 'heading':
    case 'markdown':
      break;
  }

  return null;
}
