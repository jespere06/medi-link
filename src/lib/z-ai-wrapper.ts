import { ChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

/**
 * Custom LLM Wrapper para Z.AI
 * Asegura que todas las llamadas apunten a su endpoint específico con el modelo GLM 5.1
 */
export class ChatZAI extends ChatOpenAI {
  constructor(fields?: any) {
    // Si la API key no se pasa, intentamos recuperarla del entorno
    const apiKey = fields?.apiKey || process.env.Z_AI_API_KEY;
    
    if (!apiKey || apiKey === 'YOUR_Z_AI_API_KEY') {
        throw new Error("Missing Z_AI_API_KEY in environment. Please update .env.local with a valid key for GLM 5.1.");
    }
    
    super({
      ...fields,
      apiKey: apiKey,
      streaming: true,
      configuration: {
        baseURL: process.env.Z_AI_ENDPOINT || "https://api.z.ai/api/paas/v4/",
        ...fields?.configuration,
      },

      modelName: "glm-5.1",
      modelKwargs: {
        thinking: { type: "enabled" },
        tool_stream: true,
        ...fields?.modelKwargs,
      },
    });
  }
}




