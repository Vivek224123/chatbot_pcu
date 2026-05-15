const dialogflow = require('@google-cloud/dialogflow');
const { v4: uuidv4 } = require('uuid');

const projectId = process.env.GOOGLE_PROJECT_ID;
const languageCode = process.env.DIALOGFLOW_LANGUAGE_CODE || 'en';

// Store session IDs per user phone number
const sessionIds = new Map();

function getSessionId(phoneNumber) {
  if (!sessionIds.has(phoneNumber)) {
    sessionIds.set(phoneNumber, uuidv4());
  }
  return sessionIds.get(phoneNumber);
}

async function detectIntent(phoneNumber, text) {
  const sessionId = getSessionId(phoneNumber);
  const sessionClient = new dialogflow.SessionsClient();
  const sessionPath = sessionClient.projectAgentSessionPath(
    projectId,
    sessionId
  );

  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: text,
        languageCode: languageCode,
      },
    },
  };

  try {
    const [response] = await sessionClient.detectIntent(request);
    const result = response.queryResult;

    console.log(`Dialogflow intent: ${result.intent.displayName}`);
    console.log(`Dialogflow confidence: ${result.intentDetectionConfidence}`);

    // Collect all fulfillment text messages
    const messages = result.fulfillmentMessages
      .filter((msg) => msg.text && msg.text.text && msg.text.text.length > 0)
      .map((msg) => msg.text.text[0]);

    // Fallback to fulfillmentText if no structured messages
    if (messages.length === 0 && result.fulfillmentText) {
      messages.push(result.fulfillmentText);
    }

    return {
      messages,
      intentName: result.intent ? result.intent.displayName : null,
    };
  } catch (error) {
    console.error('Dialogflow API error:', error);
    throw error;
  }
}

module.exports = { detectIntent };
