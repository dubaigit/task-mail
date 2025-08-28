/**
 * AI Service - Main AI service wrapper
 * Provides compatibility layer for existing imports
 */

const { GPTService } = require('./src/services/GPTService');

let gptServiceInstance = null;

async function getGPTService() {
  if (!gptServiceInstance) {
    gptServiceInstance = new GPTService();
    await gptServiceInstance.initialize();
  }
  return gptServiceInstance;
}

module.exports = {
  async classifyEmail(content, subject, sender) {
    const service = await getGPTService();
    return service.classifyEmail({ content, subject, sender });
  },
  
  async generateDraftReply(emailId, context) {
    const service = await getGPTService();
    return service.generateDraft(emailId, context);
  },
  
  getRequestCount() {
    return gptServiceInstance?.requestCount || 0;
  },
  
  getLastRequestTime() {
    return gptServiceInstance?.lastRequestTime || null;
  }
};
