import { createSubmission } from '../../../models/submission.js';
import { sendDiscordNotification } from '../../../services/discord.js';
import { validateSubmission } from '../../../services/validation.js';
import { logActivity } from '../../../models/activity.js';
import { jsonResponse, errorResponse } from '../../../utils/response.js';
import { getClientIp } from '../../../utils/ip.js';

export async function handleSubmit(request, env, ctx) {
  try {
    const body = await request.json();
    const validationError = validateSubmission(body);
    if (validationError) {
      return errorResponse(validationError, 400, env.CORS_ORIGIN);
    }

    const submission = await createSubmission(env, {
      discord: body.discord,
      answers: body.answers,
      ip: getClientIp(request),
    });

    if (ctx && ctx.waitUntil) {
      ctx.waitUntil(sendDiscordNotification(env, submission));
    } else {
      await sendDiscordNotification(env, submission);
    }
    await logActivity(env, 'submission_created', {
      submissionId: submission.id,
    });

    return jsonResponse({
      success: true,
      id: submission.id,
      message: 'Thank you for your feedback!',
    }, 201, env.CORS_ORIGIN);
  } catch (err) {
    console.error('Submit error:', err);
    return errorResponse('Failed to process submission: ' + err.message, 500, env.CORS_ORIGIN);
  }
}
