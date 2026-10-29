const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { ChatGroq } = require('@langchain/groq');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');

const model = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    modelName: 'llama-3.1-8b-instant',
    temperature: 0.2,
});

let cachedChunks = [];

async function loadAndSplitPDF() {
    if (cachedChunks.length > 0) return cachedChunks;

    const docsDir = path.join(__dirname, 'knowledge_base');
    if (!fs.existsSync(docsDir)) return [];

    const files = fs.readdirSync(docsDir);
    let fullText = '';

    for (const file of files) {
        if (file.endsWith('.pdf')) {
            const filePath = path.join(docsDir, file);
            const dataBuffer = fs.readFileSync(filePath);
            const parsed = await pdfParse(dataBuffer);
            fullText += parsed.text + '\n\n';
        }
    }

    if (!fullText.trim()) return [];

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
    });

    cachedChunks = await splitter.splitText(fullText);
    console.log(`PDF Loaded successfully! Total chunks created: ${cachedChunks.length}`);
    return cachedChunks;
}

async function getGroqRAGReply(userQuery, userLang = 'en') {
    try {
        const chunks = await loadAndSplitPDF();
        if (chunks.length === 0) {
            return "No PDF document was found in the Knowledge Base.";
        }

        const queryKeywords = userQuery.toLowerCase().split(' ').filter(w => w.length > 3);
        
        let bestChunk = chunks[0];
        let maxMatchCount = 0;

        chunks.forEach(chunk => {
            const lowerChunk = chunk.toLowerCase();
            let matches = 0;
            queryKeywords.forEach(kw => {
                if (lowerChunk.includes(kw)) matches++;
            });
            if (matches > maxMatchCount) {
                maxMatchCount = matches;
                bestChunk = chunk;
            }
        });

        const prompt = `You are a helpful AI assistant. Use the document excerpt provided below to answer the user's question exactly. If the answer is not available in the excerpt, clearly state: “I don't have this information.”
        
        Document Excerpt:
        ${bestChunk}
        
        User Question: ${userQuery}
        `;

        const response = await model.invoke(prompt);
        return response.content || "Kuch error aaya hai.";

    } catch (error) {
        console.error("RAG Error:", error.message);
        return "Server error, kripya baad mein koshish karein.";
    }
}

module.exports = { getGroqRAGReply };