import { getPublicConfig } from '../../../models/config.js';
import { jsonResponse, errorResponse } from '../../../utils/response.js';

export async function handlePublicConfig(request, env) {
  try {
    const config = await getPublicConfig(env);
    if (config.discord && typeof config.discord === 'object') {
      delete config.discord.webhookUrl;
    }
    return jsonResponse(config, 200, env.CORS_ORIGIN);
  } catch (e) {
    return errorResponse('Config not available.', 500, env.CORS_ORIGIN);
  }
}
