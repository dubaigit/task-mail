/**
 * Server Integration - Integrates ScheduledJobService with WebSocket server
 */

const { ScheduledJobService } = require('./services/ScheduledJobService');
const { WebSocketManager } = require('./websocket/WebSocketManager');

let scheduledJobService = null;

function initializeScheduledJobs(webSocketManager) {
  if (scheduledJobService) {
    scheduledJobService.stop();
  }
  
  scheduledJobService = new ScheduledJobService(webSocketManager);
  scheduledJobService.start();
  
  return scheduledJobService;
}

function getScheduledJobService() {
  return scheduledJobService;
}

module.exports = {
  initializeScheduledJobs,
  getScheduledJobService
};
