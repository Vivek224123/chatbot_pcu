require('dotenv').config();

const path = require('path');
const express = require('express');
const { handleWebhook, verifyWebhook } = require('./webhookHandler');
const { startSessionManager } = require('./sessionManager');
const { detectIntent } = require('./dialogflowService');
const { logMessage } = require('./logger');
const {
  initDB,
  getOrCreateUser,
  updateUserLanguage,
  updateUserState,
  resetUserToWelcome,
  getBotFlow,
  resolveLanguageSelection,
} = require('./dbService');
const adminRoutes = require('./adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize MySQL connection pool
initDB();

// Parse JSON bodies
app.use(express.json());

// Serve static files (chat UI)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

//Language selection ID to code mapping
// const LANGUAGE_MAP = {
//   lang_en: 'en', lang_hi: 'hi', lang_ta: 'ta',
//   lang_te: 'te', lang_kn: 'kn', lang_mr: 'mr',
// };



// Option ID to level mapping
const OPTION_LEVEL_MAP = {
  opt_driving_licence: 'driving_licence', opt_vehicle: 'vehicle',
  opt_challan: 'challan', opt_permit: 'permit', opt_faceless: 'faceless',
  opt_info_help: 'info_help', opt_others: 'others', opt_language: 'welcome',
  dl_learner: 'dl_learner', dl_permanent: 'dl_permanent', dl_renewal: 'dl_renewal',
  dl_duplicate: 'dl_duplicate', dl_add_class: 'dl_add_class', dl_address: 'dl_address',
  dl_name_correction: 'dl_name_correction', dl_questions: 'dl_questions',
  dl_download_form: 'dl_download_form',opt_imp_links: 'imp_links',
  dl_back: 'main_menu', veh_back: 'main_menu', ch_back: 'main_menu',
  pm_back: 'main_menu', fl_back: 'main_menu', ih_back: 'main_menu',
  ot_back: 'main_menu', ot_language: 'welcome',
  veh_register: 'veh_register', veh_transfer: 'veh_transfer', veh_noc: 'veh_noc',
  ch_check: 'ch_check', ch_pay: 'ch_pay', ch_history: 'ch_history',
  pm_apply: 'pm_apply', pm_renew: 'pm_renew', pm_status: 'pm_status',
  fl_apply: 'fl_apply', fl_status: 'fl_status', fl_docs: 'fl_docs',
  imp_website: 'imp_website', imp_office: 'imp_office', imp_services: 'imp_services',
  imp_back: 'main_menu',
  ih_faq: 'ih_faq', ih_rto: 'ih_rto', ih_docs: 'ih_docs',
  ot_feedback: 'ot_feedback', ot_complaint: 'ot_complaint', ot_contact: 'ot_contact',
  dl_prev: 'driving_licence',
  veh_prev: 'vehicle',
  ch_prev: 'challan',
  pm_prev: 'permit',
  fl_prev: 'faceless',
  ih_prev: 'info_help',
  imp_back_prev: 'imp_links',
  ot_prev: 'others',
};

// Web chat API endpoint
app.post('/chat', async (req, res) => {
  const { message, sessionId, optionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }
  if (!message && !optionId) {
    return res.status(400).json({ error: 'message or optionId is required' });
  }

  try {
    const userText = message || optionId;
    logMessage('web', sessionId, 'incoming', userText);

    const user = await getOrCreateUser(sessionId);
    const selectedId = optionId || '';

    // STEP 1: Welcome — language selection
    if (user.current_level === 'welcome') {
      // if (selectedId && LANGUAGE_MAP[selectedId]) {
      //   const langCode = LANGUAGE_MAP[selectedId];
      //   await updateUserLanguage(sessionId, langCode);
      //   const flow = await getBotFlow('main_menu', 'start', langCode, null);
      //   return res.json(buildFlowResponse(flow));
      // }
      const langCode = await resolveLanguageSelection(selectedId);
      if (langCode) {
        await updateUserLanguage(sessionId, langCode);
        let flow = await getBotFlow('main_menu', 'start', langCode, null);
        if (!flow && langCode !== 'en') {
          flow = await getBotFlow('main_menu', 'start', 'en', null);
        }
        return res.json(buildFlowResponse(flow));
      }
      const flow = await getBotFlow('welcome', 'start', 'en', null);
      return res.json(buildFlowResponse(flow));
    }

    // STEP 2: Change language
    if (selectedId === 'opt_language' || selectedId === 'ot_language') {
      await resetUserToWelcome(sessionId);
      const flow = await getBotFlow('welcome', 'start', 'en', null);
      return res.json(buildFlowResponse(flow));
    }

    // STEP 3: Navigate levels
    const userLang = user.language_code || 'en';

    if (selectedId && OPTION_LEVEL_MAP[selectedId]) {
      const nextLevel = OPTION_LEVEL_MAP[selectedId];
      await updateUserState(sessionId, nextLevel, 'start');
      let flow = await getBotFlow(nextLevel, 'start', userLang, null);
      if (!flow && userLang !== 'en') {
        flow = await getBotFlow(nextLevel, 'start', 'en', null);
      }
      if (flow) {
        //return res.json(buildFlowResponse(flow));
        return res.json(buildFlowResponse(flow, nextLevel === 'main_menu'));
      }
      // No flow found for this level yet — send placeholder
      return res.json({ replies: [`You selected: ${message || selectedId}. This feature is coming soon!`], options: null });
    }

    // STEP 4: Fallback to Dialogflow for free text
    try {
      const dfResult = await detectIntent(sessionId, userText);
      const { messages: dfMessages, intentName } = dfResult;

      // If Dialogflow matched the Default Welcome Intent, show proper welcome flow
      if (intentName === 'Default Welcome Intent') {
        await resetUserToWelcome(sessionId);
        const flow = await getBotFlow('welcome', 'start', 'en', null);
        return res.json(buildFlowResponse(flow));
      }

      const replies = dfMessages.length > 0 ? dfMessages : ["Sorry, I didn't understand that."];
      replies.forEach(r => logMessage('web', sessionId, 'outgoing', r));

      // Also return the main menu after Dialogflow response
      const menuFlow = await getBotFlow('main_menu', 'start', userLang, null);
      const menuOptions = menuFlow && menuFlow.options
        ? (typeof menuFlow.options === 'string' ? JSON.parse(menuFlow.options) : menuFlow.options)
        : null;

      return res.json({ replies, options: menuOptions });
    } catch (dfError) {
      console.error('Dialogflow error:', dfError.message);
      const menuFlow = await getBotFlow('main_menu', 'start', userLang, null);
      return res.json(buildFlowResponse(menuFlow));
    }
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

function buildFlowResponse(flow, skipIntro) {
  if (!flow) {
    return { replies: ['Something went wrong. Please try again.'], options: null, file_url: null };
  }
  const options = flow.options
    ? (typeof flow.options === 'string' ? JSON.parse(flow.options) : flow.options)
    : null;
//  return { replies: [flow.message_text], options, file_url: flow.file_url || null };
      //const parts = String(flow.message_text || '')
    let parts = String(flow.message_text || '')
    .split(/\s+---\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
    if (skipIntro && parts.length > 1) parts = [parts[parts.length - 1]];
  return {
    replies: parts.length ? parts : [flow.message_text],
    options,
    file_url: flow.file_url || null,
  };
}

// WhatsApp webhook verification (GET)
app.get('/webhook', verifyWebhook);

// WhatsApp webhook incoming messages (POST)
app.post('/webhook', handleWebhook);

// Admin API routes
app.use('/api/admin', adminRoutes);

app.listen(PORT, () => {
  console.log(`Chatbot server running on port ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`Admin Panel: http://localhost:${PORT}/admin.html`);
  startSessionManager();
});
