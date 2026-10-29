const axios = require('axios');
const { logError } = require('./logger');

const apiToken = process.env.WHATSAPP_API_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const apiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

async function sendWhatsAppMessage(to, text) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'text',
    text: {
      preview_url: false,
      body: text,
    },
  };

  try {
    const response = await axios.post(apiUrl, payload, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });
    console.log(`Message sent to ${to}: ${text.substring(0, 50)}...`);
    return response.data;
  } catch (error) {
    logError('sendWhatsAppMessage', error);
    throw error;
  }
}

async function sendWhatsAppInteractiveMessage(to, interactivePayload) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'interactive',
    interactive: interactivePayload,
  };

  try {
    const response = await axios.post(apiUrl, payload, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });
    console.log(`Interactive sent to ${to}`, JSON.stringify(response.data.messages));
    return response.data;
  } catch (error) {
    logError('sendWhatsAppInteractiveMessage', error);
    throw error;
  }
}

module.exports = { sendWhatsAppMessage, sendWhatsAppInteractiveMessage, sendWhatsAppDocument };

async function sendWhatsAppDocument(to, documentUrl, filename, caption) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'document',
    document: {
      link: documentUrl,
      filename: filename || 'document.pdf',
      caption: caption || '',
    },
  };

  try {
    const response = await axios.post(apiUrl, payload, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });
    console.log(`Document sent to ${to}: ${filename}`);
    return response.data;
  } catch (error) {
    logError('sendWhatsAppDocument', error);
    throw error;
  }
}
