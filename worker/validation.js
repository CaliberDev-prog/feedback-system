import { sanitizeString, validateDiscordUsername } from './utils.js';

const ALLOWED_TYPES = ['rating', 'text', 'textarea', 'select', 'dropdown', 'checkboxes', 'yesno'];

const TEXT_MAX = 200;
const TEXTAREA_MAX = 2000;

export function validateSubmission(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid submission data.'] };
  }

  if (data.discord !== undefined && data.discord !== null && data.discord !== '') {
    const discord = sanitizeString(String(data.discord), 37);
    if (!validateDiscordUsername(discord)) {
      errors.push('Invalid Discord username format. Must be Username#0000.');
    }
    data.discord = discord;
  }

  if (!data.answers || !Array.isArray(data.answers)) {
    return { valid: false, errors: ['No answers provided.'] };
  }

  for (let i = 0; i < data.answers.length; i++) {
    const answer = data.answers[i];
    const error = validateAnswer(answer, i);
    if (error) {
      errors.push(error);
    }
  }

  return { valid: errors.length === 0, errors, data };
}

function validateAnswer(answer, index) {
  if (!answer || typeof answer !== 'object') {
    return `Answer at index ${index} is invalid.`;
  }

  if (!answer.id || typeof answer.id !== 'string') {
    return `Answer at index ${index} is missing an ID.`;
  }

  if (!answer.type || !ALLOWED_TYPES.includes(answer.type)) {
    return `Answer "${answer.id}" has an invalid type.`;
  }

  const label = `Answer "${answer.id}"`;

  switch (answer.type) {
    case 'rating': {
      const value = Number(answer.value);
      if (isNaN(value) || !Number.isInteger(value) || value < 1 || value > 10) {
        return `${label} must be a whole number between 1 and 10.`;
      }
      break;
    }

    case 'text': {
      if (typeof answer.value !== 'string') {
        return `${label} must be text.`;
      }
      if (answer.value.length > TEXT_MAX) {
        return `${label} must be under ${TEXT_MAX} characters.`;
      }
      answer.value = sanitizeString(answer.value, TEXT_MAX);
      if (answer.required && !answer.value) {
        return `${label} is required.`;
      }
      break;
    }

    case 'textarea': {
      if (typeof answer.value !== 'string') {
        return `${label} must be text.`;
      }
      if (answer.value.length > TEXTAREA_MAX) {
        return `${label} must be under ${TEXTAREA_MAX} characters.`;
      }
      answer.value = sanitizeString(answer.value, TEXTAREA_MAX);
      if (answer.required && !answer.value) {
        return `${label} is required.`;
      }
      break;
    }

    case 'select':
    case 'dropdown': {
      if (typeof answer.value !== 'string') {
        return `${label} must be a selection.`;
      }
      if (answer.value.length > 256) {
        return `${label} value is too long.`;
      }
      if (answer.required && !answer.value) {
        return `${label} is required.`;
      }
      break;
    }

    case 'checkboxes': {
      if (!Array.isArray(answer.value)) {
        return `${label} must be a selection.`;
      }
      if (answer.value.length > 20) {
        return `${label} has too many selections.`;
      }
      for (const val of answer.value) {
        if (typeof val !== 'string' || val.length > 256) {
          return `${label} contains an invalid option.`;
        }
      }
      if (answer.required && answer.value.length === 0) {
        return `${label} is required.`;
      }
      break;
    }

    case 'yesno': {
      const normalized = String(answer.value).toLowerCase();
      if (normalized !== 'yes' && normalized !== 'no' && normalized !== 'true' && normalized !== 'false') {
        return `${label} must be Yes or No.`;
      }
      answer.value = normalized === 'yes' || normalized === 'true' ? 'Yes' : 'No';
      break;
    }
  }

  return null;
}

export function validateAdminPassword(providedPassword, storedHash) {
  if (!providedPassword || !storedHash) {
    return false;
  }
  const encoder = new TextEncoder();
  const provided = encoder.encode(providedPassword);
  const stored = encoder.encode(storedHash);
  if (provided.length !== stored.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < provided.length; i++) {
    result |= provided[i] ^ stored[i];
  }
  return result === 0;
}
