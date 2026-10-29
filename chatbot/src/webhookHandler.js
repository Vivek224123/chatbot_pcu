const { sendWhatsAppMessage, sendWhatsAppInteractiveMessage, sendWhatsAppDocument } = require('./whatsappService');
const { detectIntent } = require('./dialogflowService');
const { logMessage } = require('./logger');
const {
  getOrCreateUser,
  touchUser,
  updateUserLanguage,
  updateUserState,
  resetUserToWelcome,
  getBotFlow,
  resolveLanguageSelection,
  logMessageToDB,
  createConversation,
  getActiveConversation,
} = require('./dbService');

// Map language selection IDs to language codes
// const LANGUAGE_MAP = {
//   lang_en: 'en',
//   lang_hi: 'hi',
//   lang_ta: 'ta',
//   lang_te: 'te',
//   lang_kn: 'kn',
//   lang_mr: 'mr',
// };

// Map option IDs to levels
const OPTION_LEVEL_MAP = {
  // Main menu options
  opt_driving_licence: 'driving_licence',
  opt_vehicle: 'vehicle',
  opt_challan: 'challan',
  opt_permit: 'permit',
  opt_faceless: 'faceless',
  opt_info_help: 'info_help',
  opt_others: 'others',
  opt_language: 'welcome',
  opt_imp_links: 'imp_links',
  // Driving Licence sub-options
  dl_learner: 'dl_learner',
  dl_permanent: 'dl_permanent',
  dl_renewal: 'dl_renewal',
  dl_duplicate: 'dl_duplicate',
  dl_add_class: 'dl_add_class',
  dl_address: 'dl_address',
  dl_name_correction: 'dl_name_correction',
  dl_questions: 'dl_questions',
  dl_download_form: 'dl_download_form',
  //vahan sub option
  veh_register: 'veh_register', veh_transfer: 'veh_transfer', veh_noc: 'veh_noc',
  //challan 
   ch_check: 'ch_check', ch_pay: 'ch_pay', ch_history: 'ch_history',
  //payment
  pm_apply: 'pm_apply', pm_renew: 'pm_renew', pm_status: 'pm_status',
  //faceless
  fl_apply: 'fl_apply', fl_status: 'fl_status', fl_docs: 'fl_docs',
  //imp links
  imp_website: 'imp_website', imp_office: 'imp_office', imp_services: 'imp_services',
  imp_back: 'main_menu',
  ih_faq: 'ih_faq', ih_rto: 'ih_rto', ih_docs: 'ih_docs',
  //others
  ot_feedback: 'ot_feedback', ot_complaint: 'ot_complaint', ot_contact: 'ot_contact',
  //privious menu
  dl_prev: 'driving_licence',
  veh_prev: 'vehicle',
  ch_prev: 'challan',
  pm_prev: 'permit',
  fl_prev: 'faceless',
  ih_prev: 'info_help',
  imp_back_prev: 'imp_links',
  ot_prev: 'others',
  // Back buttons
  dl_back: 'main_menu',
  veh_back: 'main_menu',
  ch_back: 'main_menu',
  pm_back: 'main_menu',
  fl_back: 'main_menu',
  ih_back: 'main_menu',
  ot_back: 'main_menu',
  imp_back: 'main_menu',
  // Change language from Others sub-menu
  ot_language: 'welcome',
};

// async function handleWebhook(req, res) {
//   try { 
//     console.log('Received webhook event');
//     const { body } = req;

//     // Acknowledge receipt immediately
//     res.sendStatus(200);

//     if (!body.object || !body.entry) return;

//     for (const entry of body.entry) {
//       const changes = entry.changes;
//       if (!changes) continue;

//       for (const change of changes) {
//         const value = change.value;
//         if (!value || !value.messages) continue;    

//         for (const message of value.messages) {
//           await processMessage(message);
//         }
//       }
//     }
//   } catch (error) {
//     console.error('Error handling webhook:', error);
//     if (!res.headersSent) {
//       res.sendStatus(500);
//     }
//   }
// }

async function handleWebhook(req, res) {
  try {
    console.log('Received webhook event');
    const { body } = req;

    // Acknowledge receipt immediately
    res.sendStatus(200);

    if (!body.object || !body.entry) return;

    for (const entry of body.entry) {
      const changes = entry.changes;
      if (!changes) continue;

      for (const change of changes) {
        const value = change.value;

        // Delivery status (sent / delivered / read / failed)
        if (value && value.statuses) {
          for (const s of value.statuses) {
            console.log('STATUS:', s.status, s.recipient_id, s.errors ? JSON.stringify(s.errors) : '');
          }
        }

        if (!value || !value.messages) continue;

        for (const message of value.messages) {
          await processMessage(message);
        }
      }
    }
  } catch (error) {
    console.error('Error handling webhook:', error);
    if (!res.headersSent) {
      res.sendStatus(500);
    }
  }
}

async function processMessage(message) {
  console.log(`Processing message of type: ${message.type}`);
   if (message.type === 'reaction') {
    console.log(`Reaction from ${message.from}: ${message.reaction && message.reaction.emoji}`);
    return;
  }
  const senderPhone = message.from;
  let userText = '';
  let selectedId = '';
  let isDocument = false;

  switch (message.type) {
    case 'text':
      userText = message.text.body;
      break;
    case 'interactive':
      if (message.interactive.type === 'button_reply') {
        userText = message.interactive.button_reply.title;
        selectedId = message.interactive.button_reply.id;
      } else if (message.interactive.type === 'list_reply') {
        userText = message.interactive.list_reply.title;
        selectedId = message.interactive.list_reply.id;
      }
      break;
    case 'document':
    case 'image':
      isDocument = true;
      userText = message.type === 'document' 
        ? (message.document.filename || 'document') 
        : 'image';
      break;
    default:
      userText = 'Unsupported message type';
      break;
  }

  console.log(`Received from ${senderPhone}: ${userText} (id: ${selectedId})`);
  logMessage('whatsapp', senderPhone, 'incoming', userText);

  try {
    // Get or create user in DB
    const user = await getOrCreateUser(senderPhone);
    await touchUser(senderPhone);
    // Log incoming message to DB
    let conversation = await getActiveConversation(user.id);
    if (!conversation) {
      const convId = await createConversation(user.id, `wa_${senderPhone}_${Date.now()}`);
      conversation = { id: convId };
    }
    await logMessageToDB(user.id, conversation.id, 'incoming', userText, message.type, 'whatsapp');
    console.log(`Logged message to DB for user ${user.current_level} in conversation ${conversation.id}`);   
    // ── STEP 1: Language selection (welcome level) ──
    if (user.current_level === 'welcome') {
      // Check if user selected a language
      // if (selectedId && LANGUAGE_MAP[selectedId]) {
      //   const langCode = LANGUAGE_MAP[selectedId];
      const langCode = await resolveLanguageSelection(selectedId);
      if (langCode) {
        await updateUserLanguage(senderPhone, langCode);
        console.log(`User ${senderPhone} selected language: ${langCode}`);

        // Show main menu in selected language
        await sendBotFlowMessage(senderPhone, 'main_menu', 'start', langCode, user.id, conversation.id);
        return;
      }

      // Show language selection (welcome message)
      await sendBotFlowMessage(senderPhone, 'welcome', 'start', 'en', user.id, conversation.id);
      return;
    }

    // ── STEP 2: Handle "Change Language" option ──
    if (selectedId === 'opt_language') {
      await resetUserToWelcome(senderPhone);
      await sendBotFlowMessage(senderPhone, 'welcome', 'start', 'en', user.id, conversation.id);
      return;
    }

    // ── STEP 3: Handle multi-level navigation ──
    const userLang = user.language_code || 'en';

    if (selectedId && OPTION_LEVEL_MAP[selectedId]) {
      const nextLevel = OPTION_LEVEL_MAP[selectedId];
      await updateUserState(senderPhone, nextLevel, 'start');
      await sendBotFlowMessage(senderPhone, nextLevel, 'start', userLang, user.id, conversation.id, nextLevel === 'main_menu');
      return;
    }

    // ── STEP 4: Handle sub-level options or free text ──
    if (selectedId) {
      // Try to find a bot flow for this option
      const flow = await getBotFlow(user.current_level, 'start', userLang, selectedId);
      if (flow) {
        if (flow.next_level) {
          await updateUserState(senderPhone, flow.next_level, flow.next_step || 'start');
        }
        await sendFlowResponse(senderPhone, flow, user.id, conversation.id);
        return;
      }
    }

    // ── STEP 5: Fallback to Dialogflow for free text ──
    try {
      const dfResult = await detectIntent(senderPhone, userText);
      const { messages: dfMessages, intentName } = dfResult;

      // If Dialogflow matched the Default Welcome Intent, use the proper DB welcome flow
      if (intentName === 'Default Welcome Intent') {
        await resetUserToWelcome(senderPhone);
        await sendBotFlowMessage(senderPhone, 'welcome', 'start', 'en', user.id, conversation.id);
        return;
      }

      const responseTexts = dfMessages && dfMessages.length > 0
        ? dfMessages
        : [userLang === 'hi' ? 'मुझे समझ नहीं आया। कृपया मेनू से चुनें।' : 'I didn\'t understand. Please choose from the menu.'];

      for (const responseText of responseTexts) {
        logMessage('whatsapp', senderPhone, 'outgoing', responseText);
        await logMessageToDB(user.id, conversation.id, 'outgoing', responseText, 'text', 'whatsapp');
        await sendWhatsAppMessage(senderPhone, responseText);
      }

      // After Dialogflow response, show main menu again
      await sendBotFlowMessage(senderPhone, 'main_menu', 'start', userLang, user.id, conversation.id);
    } catch (dfError) {
      console.error('Dialogflow unavailable, showing menu:', dfError.message);
      await sendBotFlowMessage(senderPhone, 'main_menu', 'start', userLang, user.id, conversation.id);
    }
  } catch (error) {
    console.error(`Error processing message from ${senderPhone}:`, error);
    await sendWhatsAppMessage(
      senderPhone,
      'Sorry, something went wrong. Please try again later.'
    );
  }
}

async function sendBotFlowMessage(phone, level, step, langCode, userId, conversationId, skipIntro = false) {
  let flow = await getBotFlow(level, step, langCode, null);

  // Fallback to English if no flow found for selected language
  if (!flow && langCode !== 'en') {
    flow = await getBotFlow(level, step, 'en', null);
  }

  if (!flow) {
    const fallback = 'Sorry, something went wrong. Type "hi" to start over.';
    await sendWhatsAppMessage(phone, fallback);
    return;
  }

  await sendFlowResponse(phone, flow, userId, conversationId, skipIntro);
  await updateUserState(phone, level, step);
}

async function sendFlowResponse(phone, flow, userId, conversationId, skipIntro = false) {
  logMessage('whatsapp', phone, 'outgoing', flow.message_text);
  await logMessageToDB(userId, conversationId, 'outgoing', flow.message_text, flow.message_type, 'whatsapp');
    const parts = String(flow.message_text || '')
    .split(/\s+---\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  // if (parts.length > 1) {
  //   for (const p of parts.slice(0, -1)) {
  //     await sendWhatsAppMessage(phone, p);
  //   }
  //   flow = { ...flow, message_text: parts[parts.length - 1] };
  // }
  if (parts.length > 1) {
    if (!skipIntro) {
      for (const p of parts.slice(0, -1)) {
        await sendWhatsAppMessage(phone, p);
      }
    }
    flow = { ...flow, message_text: parts[parts.length - 1] };
  }

  // Send attached document/PDF if present
  if (flow.file_url) {
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const fullUrl = flow.file_url.startsWith('http') ? flow.file_url : baseUrl + flow.file_url;
    const filename = flow.file_url.split('/').pop();
    try {
      //await sendWhatsAppDocument(phone, fullUrl, filename, flow.message_text);
      await sendWhatsAppDocument(phone, fullUrl, filename, '');
    } catch (docErr) {
      console.error('Failed to send document:', docErr.message);
      //await sendWhatsAppMessage(phone, flow.message_text + '\n\n📄 Download: ' + fullUrl);
      await sendWhatsAppMessage(phone, '📄 Download: ' + fullUrl);
    }
  }

  if (flow.message_type === 'interactive_list' && flow.options) {
    const options = typeof flow.options === 'string' ? JSON.parse(flow.options) : flow.options;
    const interactivePayload = {
      type: 'list',
      body: { text: flow.message_text },
      action: {
        button: 'view menu',
        sections: [
          {
            title: 'Options',
            rows: options.map((opt) => ({
              id: opt.id,
              title: opt.title.substring(0, 24),
              description: opt.description ? opt.description.substring(0, 72) : undefined,
            })),
          },
        ],
      },
    };
    await sendWhatsAppInteractiveMessage(phone, interactivePayload);
  } else if (flow.message_type === 'interactive_button' && flow.options) {
    const options = typeof flow.options === 'string' ? JSON.parse(flow.options) : flow.options;
    const interactivePayload = {
      type: 'button',
      body: { text: flow.message_text },
      action: {
        buttons: options.slice(0, 3).map((opt) => ({
          type: 'reply',
          reply: { id: opt.id, title: opt.title.substring(0, 20) },
        })),
      },
    };
    await sendWhatsAppInteractiveMessage(phone, interactivePayload);
  } else {
    await sendWhatsAppMessage(phone, flow.message_text);

    // If there's a next level, auto-navigate
    if (flow.next_level) {
      await sendBotFlowMessage(phone, flow.next_level, flow.next_step || 'start',
        'en', userId, conversationId);
    }
  }
}

function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('Webhook verified successfully');
    return res.status(200).send(challenge);
  }

  console.warn('Webhook verification failed');
  return res.sendStatus(403);
}

module.exports = { handleWebhook, verifyWebhook };
