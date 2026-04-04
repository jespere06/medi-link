import { auth0 } from "../../../lib/auth0";
import { getOrchestrator } from "../../../lib/agents/orchestrator";
import { NextRequest, NextResponse } from "next/server";
import { HumanMessage } from "@langchain/core/messages";

/**
 * Chat Endpoint — Orchestrates the LangGraph flow with the GLM 5.1 copilot.
 * Extracts the Refresh Token from the session to inject it into the Token Vault.
 */
export async function POST(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, patientId } = await req.json();

  // 1. Get the orchestrator — can fail if Z_AI_API_KEY is missing
  let orchestrator;
  try {
    orchestrator = getOrchestrator();
  } catch (err: any) {
    if (err.message?.includes("Z_AI_API_KEY")) {
      return NextResponse.json({
        reply:
          "⚠️ **Configuration Required**\n\nNo valid `Z_AI_API_KEY` was detected in the server environment.\n\nTo activate the GLM 5.1 copilot, configure your key in `.env.local`:\n```\nZ_AI_API_KEY='your-real-key'\n```\nThen restart the development server.",
      }, { status: 200 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  // 2. Invoke the agent
  try {
    const { token: accessToken } = await auth0.getAccessToken();

    // 🟢 Extract and verify the Refresh Token in the console
    const s = session as any;
    const rt = s?.refreshToken || s?.refresh_token || s?.tokenSet?.refreshToken || s?.tokenSet?.refresh_token;
    
    console.log("🔑 [DEBUG] Extracting Refresh Token from session:", rt ? "FOUND!" : "NO TOKEN");

    const config = {
      configurable: {
        thread_id: session.user.sub,
        // 🟢 Inject the Refresh Token into the 'auth0' section that the SDK automatically looks for
        auth0: {
          refreshToken: rt,
        },
        langgraph_auth_user: {
          getRawAccessToken: async () => accessToken,
        },
      },
    };

    const contextualizedMessage = patientId 
      ? `[Context Injected from UI: The doctor has selected the patient with ID: ${patientId}]\n${message}`
      : message;

    const eventStream = await orchestrator.streamEvents(
      { messages: [new HumanMessage(contextualizedMessage)] },
      { ...config, version: "v2" }
    );

    const encoder = new TextEncoder();
    let isWaitingForAgent = false;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log("[DEBUG] BE: Starting event streaming...");
          
          for await (const event of eventStream) {
            const { event: eventType, data, name: eventName } = event;
            const metadata = event.metadata ?? {};
            const langgraphNode = metadata.langgraph_node;

            if (eventType !== "on_chat_model_stream") {
              console.log(`[BACKEND-STREAM] Event: ${eventType} | Node: ${langgraphNode || 'N/A'} | Source: ${eventName || 'N/A'}`);
            }
            
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: "debug", 
                message: `Event: ${eventType} | Node: ${langgraphNode || 'N/A'} | Source: ${eventName || 'N/A'}` 
              })}\n\n`)
            );

            // ── Fix: Only emit tokens from the main agent node ──
            if (eventType === "on_chat_model_stream") {
              if (langgraphNode && langgraphNode !== "agent") continue;
              
              const chunk = data.chunk?.content;
              const reasoning = data.chunk?.additional_kwargs?.reasoning_content;
              
              if (reasoning) {
                 controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "thought", content: reasoning })}\n\n`)
                );
              }

              if (chunk) {
                if (isWaitingForAgent) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "agent_resume" })}\n\n`)
                  );
                  isWaitingForAgent = false;
                }
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`)
                );
              }
            }
            
            if (eventType === "on_tool_start") {
              console.log(`[DEBUG] BE: tool_start -> ${event.name}`);
              isWaitingForAgent = true;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: "tool_start",
                  id: event.run_id,
                  name: event.name,
                  params: data?.input ?? data?.toolInput ?? data?.args ?? data,
                })}\n\n`)
              );
            }
            
            if (eventType === "on_tool_end") {
              console.log(`[DEBUG] BE: tool_end -> ${event.name}`);
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: "tool_end",
                  id: event.run_id,
                  name: event.name,
                  output: data?.output ?? data?.result ?? data,
                })}\n\n`)
              );
            }

            if (eventType === "on_tool_error") {
              const errorRaw = data?.error ?? "";
              const errorStr = typeof errorRaw === 'string' ? errorRaw : JSON.stringify(errorRaw);
              console.log(`[DEBUG] BE: tool_error in ${event.name}: ${errorStr.substring(0, 500)}`);

              // Detect if the tool error is actually an Auth0 Interrupt
              if (errorStr.includes("AUTH0_AI_INTERRUPT") || errorStr.includes("TOKEN_VAULT_ERROR") || errorStr.includes("GraphInterrupt") || errorStr.includes("Missing Google Auth Token")) {
                console.log("[DEBUG] BE: Interrupt or missing Token detected in on_tool_error. Triggering interrupt...");
                
                let interruptValue: any = null;
                try {
                  const jsonToParse = errorStr.includes("\n\nGraphInterrupt:") 
                    ? errorStr.split("\n\nGraphInterrupt:")[0].trim() 
                    : errorStr;
                  const parsed = JSON.parse(jsonToParse);
                  interruptValue = Array.isArray(parsed) ? parsed[0]?.value : parsed?.value || parsed;
                } catch (e) {
                  // Fallback para strings
                }

                // 🟢 Extraction bulletproofing (without using JSON.parse which breaks with stacktraces)
                let cleanMessage = "Google Workspace authorization is required to continue.";
                if (errorStr.includes("federated_connection_refresh_token_not_found")) {
                  cleanMessage = "You have not yet authorized MediLink AI. Click the green button to connect your Google Calendar.";
                } else if (errorStr.includes("No hay Refresh Token")) {
                  cleanMessage = "Your session does not have sufficient permissions. Log out and log back in.";
                }

                const finalInterruptData = (interruptValue && typeof interruptValue === 'object' && 'connection' in interruptValue)
                  ? { ...interruptValue, reason: cleanMessage } 
                  : { 
                      reason: cleanMessage,
                      connection: "google-oauth2",
                      scopes: [
                        'openid', 
                        'https://www.googleapis.com/auth/userinfo.email', 
                        'https://www.googleapis.com/auth/userinfo.profile', 
                        'https://www.googleapis.com/auth/calendar.events'
                      ],
                      requiredScopes: [
                        'openid', 
                        'https://www.googleapis.com/auth/userinfo.email', 
                        'https://www.googleapis.com/auth/userinfo.profile', 
                        'https://www.googleapis.com/auth/calendar.events'
                      ],
                      authorizationParams: {},
                    };

                console.log("[DEBUG] BE: Enviando interrupt al frontend:", JSON.stringify(finalInterruptData));
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ 
                    type: "interrupt", 
                    data: finalInterruptData 
                  })}\n\n`)
                );
                continue; 
              } else {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: "error",
                    message: `Error in tool ${event.name}: ${data?.error ?? "Unknown"}`,
                  })}\n\n`)
                );
              }
            }
          }
          console.log("[DEBUG] BE: Streaming completed normally.");
          controller.close();
        } catch (err: any) {
          console.log("\n=======================================================");
          console.log("🛑 [STREAM CATCH] EXCEPTION CAUGHT IN GRAPH EXECUTION");
          console.log("=======================================================");
          console.log(`- Error Name: ${err.name}`);
          console.log(`- Message: ${err.message}`);
          
          // 🟢 REAL FIX: If the error is our controlled interrupt, 
          // WE MUST NOTIFY THE FRONTEND before closing the stream.
          if (err.name === 'GraphInterrupt' || err.message?.includes('AUTH0_AI_INTERRUPT')) {
            console.log("\n[DEBUG] BE: ⚠️ Auth0 Token Vault interrupt detected.");
            console.log("[DEBUG] BE: Preparing interrupt payload for the UI...");
            
            const finalInterruptData = { 
                reason: "MediLink AI Scribe requires Google Workspace authorization to schedule this appointment.",
                connection: "google-oauth2",
                scopes: [
                  'openid', 
                  'https://www.googleapis.com/auth/userinfo.email', 
                  'https://www.googleapis.com/auth/userinfo.profile', 
                  'https://www.googleapis.com/auth/calendar.events'
                ],
                requiredScopes: [
                  'openid', 
                  'https://www.googleapis.com/auth/userinfo.email', 
                  'https://www.googleapis.com/auth/userinfo.profile', 
                  'https://www.googleapis.com/auth/calendar.events'
                ],
                authorizationParams: {
                    prompt: "consent",
                    access_type: "offline"
                }
            };

            console.log("[DEBUG] BE: Generated payload:", JSON.stringify(finalInterruptData, null, 2));

            // 🔥 FORCING THE SIGNAL TO THE FRONTEND
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ 
                  type: "interrupt", 
                  data: finalInterruptData 
                })}\n\n`)
              );
              console.log("[DEBUG] BE: ✅ 'interrupt' signal successfully enqueued in the stream to the client.");
            } catch (enqueueErr: any) {
              console.error("[DEBUG] BE: ❌ FATAL: Could not enqueue interrupt in the stream. Error:", enqueueErr.message);
            }
            
            console.log("=======================================================\n");
            controller.close();
            return;
          }

          // Si es un error real crítico de red, Z.AI, o código, lo imprimimos con Stack Trace
          console.error("\n[DEBUG] BE: 💥 UNCONTROLLED CRITICAL ERROR");
          console.error(err.stack || err);
          console.log("=======================================================\n");
          
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "error", message: `Critical Error: ${err.message}` })}\n\n`)
            );
          } catch (e) {
            console.error("Failed to send error to client:", e);
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("[chat/route] Pre-stream setup error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
