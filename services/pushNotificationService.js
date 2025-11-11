/**
 * Push Notification Service
 * Sends push notifications using Expo's Push Notification API
 */

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send push notification to a single device
 * @param {string} pushToken - Expo push token
 * @param {string} title - Notification title
 * @param {string} body - Notification message
 * @param {object} data - Additional data to send with notification
 * @returns {Promise<object>} Response from Expo API
 */
async function sendPushNotification(pushToken, title, body, data = {}) {
  try {
    const message = {
      to: pushToken,
      sound: 'default',
      title: title,
      body: body,
      data: data,
      priority: 'high',
      channelId: 'default',
    };

    const response = await fetch(EXPO_PUSH_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    
    if (result.data && result.data.status === 'ok') {
      console.log(`Push notification sent successfully to ${pushToken}`);
      return { success: true, result };
    } else {
      console.error(`Failed to send push notification:`, result);
      return { success: false, error: result };
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send push notifications to multiple devices
 * @param {Array<string>} pushTokens - Array of Expo push tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification message
 * @param {object} data - Additional data to send with notification
 * @returns {Promise<object>} Results of sending notifications
 */
async function sendPushNotifications(pushTokens, title, body, data = {}) {
  if (!pushTokens || pushTokens.length === 0) {
    return { success: 0, failed: 0, errors: [] };
  }

  // Filter out invalid tokens
  const validTokens = pushTokens.filter(token => token && typeof token === 'string');
  
  if (validTokens.length === 0) {
    return { success: 0, failed: 0, errors: ['No valid push tokens'] };
  }

  // Expo allows sending to multiple tokens in a single request
  const messages = validTokens.map(token => ({
    to: token,
    sound: 'default',
    title: title,
    body: body,
    data: data,
    priority: 'high',
    channelId: 'default',
  }));

  try {
    const response = await fetch(EXPO_PUSH_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const results = await response.json();
    
    // Count successes and failures
    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    if (Array.isArray(results.data)) {
      results.data.forEach((result, index) => {
        if (result.status === 'ok') {
          successCount++;
        } else {
          failedCount++;
          errors.push({
            token: validTokens[index],
            error: result.message || 'Unknown error',
          });
        }
      });
    } else if (results.data && results.data.status === 'ok') {
      successCount = validTokens.length;
    } else {
      failedCount = validTokens.length;
      errors.push({ error: results.message || 'Failed to send notifications' });
    }

    console.log(`Push notifications sent: ${successCount} success, ${failedCount} failed`);
    
    return {
      success: successCount,
      failed: failedCount,
      errors,
      results,
    };
  } catch (error) {
    console.error('Error sending push notifications:', error);
    return {
      success: 0,
      failed: validTokens.length,
      errors: [{ error: error.message }],
    };
  }
}

export { sendPushNotification, sendPushNotifications };

