
const { ChatOpenAI } = require("@langchain/openai");
const { z } = require("zod");
const { DynamicStructuredTool } = require("@langchain/core/tools");

async function test() {
  const apiKey = 'a54d59b0d1c7488e953ad3c48974be18.r5sNSjrPpwlyxpm7';
  const baseURL = 'https://api.z.ai/api/paas/v4/';
  
  const model = new ChatOpenAI({
    apiKey,
    configuration: {
        baseURL,
    },
    // Probamos con glm-5.1 a ver si fue por el nombre
    modelName: "glm-5.1",
    temperature: 0,
  });

  const tool = new DynamicStructuredTool({
    name: "read_patient_clinical_record",
    description: "Lee el historial clínico",
    schema: z.object({
        patientId: z.string()
    }),
    func: async () => "Resultado de prueba"
  });

  const modelWithTools = model.bindTools([tool]);

  console.log("Iniciando prueba de Tool Calling...");
  try {
    const res = await modelWithTools.invoke("Lee el historial del paciente 123");
    console.log("Respuesta completa:", JSON.stringify(res, null, 2));
    console.log("Tool Calls:", res.tool_calls);
  } catch (err) {
    console.error("Error en prueba:", err.message);
  }
}

test();
