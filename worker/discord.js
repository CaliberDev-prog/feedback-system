export function formatDiscordEmbed(data, config) {
  const fields = [];
  const timestamp = new Date().toISOString();

  if (data.discord) {
    fields.push({
      name: 'Discord Username',
      value: data.discord,
      inline: true,
    });
  }

  if (data.answers && Array.isArray(data.answers)) {
    for (const answer of data.answers) {
      if (answer.value === undefined || answer.value === null || answer.value === '') {
        continue;
      }
      const value = formatAnswerValue(answer);
      const label = answer.label || answer.id;
      fields.push({
        name: label,
        value: value,
        inline: shouldInline(answer.type),
      });
    }
  }

  const accentColor = config.accentColor || 0x8b5cf6;
  const color = typeof accentColor === 'string'
    ? parseInt(accentColor.replace('#', ''), 16)
    : accentColor;

  return {
    embeds: [
      {
        title: config.embedTitle || 'New Feedback Submission',
        color: color,
        fields: fields,
        timestamp: timestamp,
        footer: {
          text: config.embedFooter || 'Feedback System',
        },
      },
    ],
  };
}

function formatAnswerValue(answer) {
  switch (answer.type) {
    case 'rating': {
      const num = Number(answer.value);
      if (isNaN(num)) return String(answer.value);
      const clamped = Math.max(1, Math.min(10, num));
      const stars = '\u2605'.repeat(Math.min(clamped, 5)) + '\u2606'.repeat(Math.max(0, 5 - Math.min(clamped, 5)));
      return `${stars} (${clamped})`;
    }
    case 'yesno': {
      const val = String(answer.value).toLowerCase();
      if (val === 'yes' || val === 'true') {
        return 'Yes';
      }
      return 'No';
    }
    case 'checkboxes': {
      if (Array.isArray(answer.value) && answer.value.length > 0) {
        return answer.value.map((v) => '\u2022 ' + v).join('\n');
      }
      return 'None selected';
    }
    default:
      return String(answer.value);
  }
}

function shouldInline(type) {
  return ['rating', 'yesno', 'select', 'dropdown'].includes(type);
}
