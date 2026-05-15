# WhatsApp Dialogflow Chatbot

A chatbot that connects WhatsApp Cloud API with Google Dialogflow for natural language processing.

## Architecture

```
User (WhatsApp) → Meta Webhook → Express Server → Dialogflow → Response → WhatsApp Cloud API → User
```

## Prerequisites

- Node.js 18+
- A [Meta Developer](https://developers.facebook.com/) account with a WhatsApp Business app
- A [Google Cloud](https://console.cloud.google.com/) project with Dialogflow API enabled
- A Dialogflow agent with configured intents

## Setup

### 1. Clone & Install

```bash
cd /var/www/html/chatbot
npm install
```

### 2. Configure WhatsApp Cloud API

1. Go to [Meta for Developers](https://developers.facebook.com/) and create a Business App.
2. Add the **WhatsApp** product.
3. In **WhatsApp > API Setup**, note the:
   - **Temporary access token** (or create a permanent System User token)
   - **Phone number ID**
4. Set up a webhook with your server URL: `https://yourdomain.com/webhook`
5. Subscribe to the `messages` webhook field.

### 3. Configure Google Dialogflow

1. Create a Dialogflow agent at [Dialogflow Console](https://dialogflow.cloud.google.com/).
2. Note the **Google Project ID** from the agent settings.
3. Create a service account in [Google Cloud Console](https://console.cloud.google.com/iam-admin/serviceaccounts):
   - Grant the **Dialogflow API Client** role.
   - Create a JSON key and download it.
4. Place the key file at `credentials/dialogflow-key.json`.

### 4. Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `WHATSAPP_API_TOKEN` | Your WhatsApp Cloud API access token |
| `WHATSAPP_PHONE_NUMBER_ID` | Your WhatsApp phone number ID |
| `WHATSAPP_VERIFY_TOKEN` | A custom string for webhook verification |
| `GOOGLE_PROJECT_ID` | Your Dialogflow Google Cloud project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Dialogflow service account JSON key |
| `DIALOGFLOW_LANGUAGE_CODE` | Language code (default: `en`) |
| `PORT` | Server port (default: `3000`) |

### 5. Run

```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

### 6. Expose via HTTPS

WhatsApp requires an HTTPS webhook URL. Options:

- **ngrok** (development): `ngrok http 3000`
- **Reverse proxy** (production): Configure Nginx/Apache with SSL in front of the Node.js server.

## Project Structure

```
src/
├── app.js                # Express server & routes
├── webhookHandler.js     # WhatsApp webhook verification & message routing
├── dialogflowService.js  # Dialogflow intent detection
└── whatsappService.js    # WhatsApp Cloud API message sending
```

## How It Works

1. A user sends a message on WhatsApp.
2. Meta forwards the message to your `/webhook` endpoint.
3. The server extracts the message text and sender phone number.
4. The text is sent to Dialogflow for intent matching.
5. Dialogflow's response is sent back to the user via WhatsApp Cloud API.

## Adding Dialogflow Intents

Create intents in the [Dialogflow Console](https://dialogflow.cloud.google.com/):

- **Training phrases**: Example messages users might send.
- **Responses**: What the bot should reply with.

The chatbot will automatically use any intents you configure in Dialogflow.
