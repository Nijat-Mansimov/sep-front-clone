import { GoogleGenAI } from '@google/genai';
import express from 'express';

const ALLOWED_CHAT_MODELS = new Set([
  'gemini-4-hydrogen',
  'gemini-4-carbon',
  'gemini-4-neon',
  'gemini-3.1-flash-lite',
]);

const ALLOWED_IMAGE_SIZES = new Set(['1K', '2K', '4K']);
const ALLOWED_ASPECT_RATIOS = new Set(['1:1', '16:9', '4:3', '3:4', '9:16']);

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function createGeminiRouter(): express.Router {
  const router = express.Router();
  router.use(express.json({ limit: '2mb' }));

  router.post('/chat', async (req, res) => {
    try {
      const body = req.body as {
        model?: string;
        systemInstruction?: string;
        history?: Array<{ role: 'user' | 'model'; text: string }>;
        message?: string;
      };

      const message = (body.message ?? '').trim();
      if (!message) {
        res.status(400).json({ error: 'Message is required.' });
        return;
      }

      const model = body.model && ALLOWED_CHAT_MODELS.has(body.model)
        ? body.model
        : 'gemini-4-hydrogen';

      const systemInstruction = (body.systemInstruction ?? '').trim() ||
        'You are a senior detection engineering specialist helping security analysts write, validate, and translate SIEM/XDR detection rules (SEP Detection v1, Sigma, XQL, SPL, KQL) and map MITRE ATT&CK techniques.';

      const ai = getAiClient();
      const historyContents = (body.history ?? [])
        .filter((h) => h && (h.role === 'user' || h.role === 'model') && typeof h.text === 'string' && h.text.trim())
        .map((h) => ({
          role: h.role,
          parts: [{ text: h.text }],
        }));

      const chat = ai.chats.create({
        model,
        history: historyContents,
        config: {
          systemInstruction,
        },
      });

      const response = await chat.sendMessage({ message });
      res.json({
        reply: response.text ?? '',
        model,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gemini chat request failed';
      res.status(500).json({ error: msg });
    }
  });

  router.post('/image', async (req, res) => {
    try {
      const body = req.body as {
        prompt?: string;
        imageSize?: string;
        aspectRatio?: string;
      };

      const prompt = (body.prompt ?? '').trim();
      if (!prompt) {
        res.status(400).json({ error: 'Image prompt is required.' });
        return;
      }

      const imageSize = body.imageSize && ALLOWED_IMAGE_SIZES.has(body.imageSize)
        ? body.imageSize
        : '1K';
      const aspectRatio = body.aspectRatio && ALLOWED_ASPECT_RATIOS.has(body.aspectRatio)
        ? body.aspectRatio
        : '16:9';

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio,
            imageSize,
          },
        },
      });

      let imageUrl: string | null = null;
      let text = '';
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          text += part.text;
        }
      }

      if (!imageUrl) {
        res.status(502).json({ error: text || 'Model did not return an image asset.' });
        return;
      }

      res.json({
        imageUrl,
        text,
        imageSize,
        aspectRatio,
        model: 'gemini-3-pro-image-preview',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Image generation failed';
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
