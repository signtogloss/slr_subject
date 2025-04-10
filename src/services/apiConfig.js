/**
 * apiConfig.js
 * 集中管理API URL配置
 */

// 从环境变量中获取API基础URL
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'wss://gloss.ngrok.dev';

// API端点配置
const API_ENDPOINTS = {
  // WebSocket端点
  SPEECH_TO_TEXT: `${API_BASE_URL}/ws/speech2text`,
  SPEECH_TO_VIDEO: `${API_BASE_URL}/ws/speech2video`,
  GLOSS_TO_VIDEO: `${API_BASE_URL}/ws/gloss2video_redis`,
  
  // 其他可能的HTTP端点
  // USER_API: `${API_BASE_URL}/api/users`,
  // AUTH_API: `${API_BASE_URL}/api/auth`,
};

export default API_ENDPOINTS;