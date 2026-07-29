import { formatDiscordValue } from '../utils/sanitize.js';

export async function sendDiscordNotification(env, submission) {
  const webhookUrl = env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const fields = [];

  if (submission.discord) {
    fields.push({ name: 'Discord Username', value: submission.discord, inline: true });
  }

  for (const answer of submission.answers) {
    if (!answer.value || (Array.isArray(answer.value) && answer.value.length === 0)) continue;
    fields.push({
      name: answer.label || answer.id,
      value: formatDiscordValue(answer),
      inline: ['rating', 'yesno', 'select', 'dropdown'].includes(answer.type),
    });
  }

  const embed = {
    embeds: [{
      title: 'New Feedback Submission',
      color: 0x8b5cf6,
      fields,
      timestamp: new Date(submission.timestamp).toISOString(),
      footer: { text: 'Feedback System' },
    }],
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embed),
    });
  } catch {}
}
