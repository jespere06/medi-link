import { ChatZAI } from "../z-ai-wrapper";
import { googleCalendarTool } from "./calendar-tool";
import { readPatientRecordTool, createClinicalNoteTool } from "./fhir-tool";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { BaseMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { MemorySaver, StateGraph, MessagesAnnotation } from "@langchain/langgraph";

// Mensaje de sistema para el agente MediLink AI Scribe
const ASSISTANT_SYSTEM_PROMPT = new SystemMessage(
  `You are MediLink AI Scribe, an advanced medical agent. Your mission is to assist physicians by orchestrating clinical triages, analyzing drug interactions, and managing data on FHIR servers.

OPERATING RULES:
1. You MUST execute 'read_patient_clinical_record' before any patient analysis or management request.
2. When reading the FHIR history, analyze potential interactions between listed medications and newly suggested prescriptions.
3. Your priority is to take action. Once you have the data, deliver a professional medical report in Markdown.
4. If information is missing (e.g., Patient ID), ask for it concisely.`
);





// Agregamos memoria persistente temporal para la sesión
const checkpointer = new MemorySaver();

// Lazy singleton para evitar que el módulo explote al importarse si falta la API key
let _appOrchestrator: any = null;

export function getOrchestrator() {
  if (!_appOrchestrator) {
    const llm = new ChatZAI({ 
      temperature: 0.1,
      maxTokens: 4096
    });

    const tools = [readPatientRecordTool, googleCalendarTool, createClinicalNoteTool];
    
    // Configuración clave: Auth0 Token Vault requiere que NO atrapemos
    // los errores de las herramientas para poder emitir "Interrupts" hacia el UI.
    const toolNode = new ToolNode(tools, { handleToolErrors: false });
    
    const llmWithTools = llm.bindTools(tools, { tool_choice: "auto" });


    async function agentNode(state: typeof MessagesAnnotation.State) {
      console.log(`[ORCHESTRATOR] Invocando LLM para nodo 'agent'...`);
      const result = await llmWithTools.invoke([
        ASSISTANT_SYSTEM_PROMPT,
        ...state.messages,
      ]);

      console.log(`[ORCHESTRATOR] Respuesta LLM:`, {
        content: result.content ? (result.content.toString().substring(0, 50) + "...") : "(vacío)",
        tool_calls_count: result.tool_calls?.length || 0,
        tool_names: result.tool_calls?.map(tc => tc.name) || []
      });

      return { messages: [result] };
    }


    const workflow = new StateGraph(MessagesAnnotation)
      .addNode("agent", agentNode)
      .addNode("tools", toolNode)
      .addEdge("__start__", "agent")
      .addConditionalEdges("agent", (state) => {
        const lastMsg = state.messages[state.messages.length - 1];
        
        // Robust check for tool_calls property
        const hasToolCalls = (lastMsg as any).tool_calls && (lastMsg as any).tool_calls.length > 0;
        
        console.log(`[EDGE] Verificando transición desde 'agent':`, {
          hasMessages: state.messages.length > 0,
          lastMsgType: lastMsg?.constructor?.name,
          hasToolCalls: hasToolCalls,
          toolCount: (lastMsg as any).tool_calls?.length
        });

        if (hasToolCalls) {
          console.log(`[EDGE] 🚀 Transicionando a 'tools'...`);
          return "tools";
        }
        
        console.log(`[EDGE] 🏁 No se detectaron tools, finalizando grafo.`);
        return "__end__";
      })
      .addEdge("tools", "agent");

    _appOrchestrator = workflow.compile({ checkpointer });
  }
  return _appOrchestrator;
}

export const appOrchestrator = null as any;
