"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { TokenVaultInterruptHandler } from "../components/auth0-ai/TokenVault";
import {
  ShieldCheck, Activity, Stethoscope, BrainCircuit, User, ShieldAlert, Send,
  Calendar, Sparkles, ClipboardList, HeartPulse, ArrowRight, Search, Users,
  UserCheck, Phone, MapPin, Plus, X, Loader2, AlertTriangle,
  Shield, Trash2, Square, Mic, Paperclip, FileText, Image, ChevronDown
} from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';


// ─── Suggestion Cards ─────────────────────────────────
const AGENTIC_SUGGESTIONS = [
  {
    icon: Mic,
    title: "End-to-End Orchestration (Demo)",
    description: "Master flow: Reads patient data, saves transcribed clinical note, and schedules discharge.",
    prompt: "Based on the transcription of my voice note, execute the following flow in strict order: 1. Extract main findings. 2. Save this clinical note in the patient's FHIR record. 3. Schedule medical discharge in Google Calendar with the primary diagnosis. 4. Finish by reading the clinical record again to confirm the updated status. \n\n[Audio note]: ",
    color: "from-rose-500/20 to-rose-600/5",
    iconColor: "text-rose-400",
    borderColor: "border-rose-500/20 hover:border-rose-500/40",
  },
  {
    icon: ClipboardList,
    title: "Risk Assessment",
    description: "Analyzes clinical risk factors and generates a pre-discharge safety protocol.",
    prompt: "Analyze the patient's clinical risk factors and generate a Clinical Risk Summary compared against the standard discharge protocol.",
    color: "from-amber-500/20 to-amber-600/5",
    iconColor: "text-amber-400",
    borderColor: "border-amber-500/20 hover:border-amber-500/40",
  },
  {
    icon: Calendar,
    title: "Schedule Medical Discharge",
    description: "Schedules the discharge appointment in Google Calendar after validating patient stability.",
    prompt: "Review the patient's status and, if stable, schedule their medical discharge in Google Calendar with the discharge diagnosis.",
    color: "from-emerald-500/20 to-emerald-600/5",
    iconColor: "text-emerald-400",
    borderColor: "border-emerald-500/20 hover:border-emerald-500/40",
  },
  {
    icon: Sparkles,
    title: "GLM 5.1 Open Consultation",
    description: "Ask any clinical question to the advanced medical language model.",
    prompt: "What are the current best practices for post-hospitalization outpatient management of a patient with multiple comorbidities?",
    color: "from-primary-500/20 to-cyan-500/5",
    iconColor: "text-cyan-400",
    borderColor: "border-cyan-500/20 hover:border-cyan-500/40",
  }
];

// ─── Helpers ──────────────────────────────────────────
function getPatientDisplayName(patient: any): string {
  const name = patient?.name?.[0];
  if (!name) return "Unnamed Patient";
  const given = name.given?.join(" ") || "";
  const family = name.family || "";
  return `${given} ${family}`.trim();
}

function getPatientInitials(patient: any): string {
  const name = patient?.name?.[0];
  const first = name?.given?.[0]?.[0] || "?";
  const last = name?.family?.[0] || "?";
  return `${first}${last}`.toUpperCase();
}

function getAge(birthDate: string | undefined): string {
  if (!birthDate) return "—";
  const diff = Date.now() - new Date(birthDate).getTime();
  return `${Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))} years old`;
}

function getPatientPhone(patient: any): string | null {
  return patient?.telecom?.find((t: any) => t.system === "phone")?.value || null;
}

function getPatientCity(patient: any): string | null {
  return patient?.address?.[0]?.city || null;
}

const AVATAR_COLORS = [
  "from-cyan-500 to-blue-600",
  "from-violet-500 to-purple-600",
  "from-rose-500 to-pink-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-sky-500 to-indigo-600",
];

function getAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

// ─── Types ────────────────────────────────────────────
type MessageSegment =
  | { type: "text"; content: string }
  | { type: "thought"; content: string }
  | { type: "tool_start"; id: string; name: string; params?: any }
  | { type: "tool_end"; id: string; name: string; output?: any };


type Attachment = {
  type: "audio" | "image" | "file";
  name: string;
  url?: string;
  transcription?: string;
  isTranscribing?: boolean;
};

type ChatMessage =
  | { id?: string; role: "user"; content: string; attachments?: Attachment[] }
  | { id?: string; role: "agent"; segments: MessageSegment[] };

// ─── Component ────────────────────────────────────────
export default function ClientPage({ user }: { user: any }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [interrupt, setInterrupt] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [expandedTranscriptions, setExpandedTranscriptions] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // ─── Auto-scroll to bottom on new messages or loading ───
  useEffect(() => {
    if (scrollRef.current && !showScrollButton) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages, loading, showScrollButton]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth"
      });
      setShowScrollButton(false);
    }
  }, []);

  const toggleTranscription = (msgIdx: number, attIdx: number) => {
    const key = `${msgIdx}-${attIdx}`;
    setExpandedTranscriptions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Local workspace — patients the doctor has pulled for the session
  const [workspace, setWorkspace] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  
  // Search modal
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Filtrar pacientes del workspace
  const [workspaceFilter, setWorkspaceFilter] = useState("");
  const filteredWorkspace = useMemo(() => {
    if (!workspaceFilter.trim()) return workspace;
    const q = workspaceFilter.toLowerCase();
    return workspace.filter((p: any) => {
      const name = getPatientDisplayName(p).toLowerCase();
      return name.includes(q) || p.id?.toLowerCase().includes(q);
    });
  }, [workspace, workspaceFilter]);

  const selectedPatient = workspace.find((p: any) => p.id === selectedPatientId) || null;

  // ─── Search patient in FHIR ──────────────────────
  const searchPatients = useCallback(async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return;
    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    
    try {
      // Detect if it is UUID or name
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/.test(searchQuery.trim());
      const type = isUuid ? "id" : "name";
      
      const res = await fetch(`/api/patients/search?q=${encodeURIComponent(searchQuery.trim())}&type=${type}`);
      const data = await res.json();
      
      if (!res.ok) {
        setSearchError(data.error || "Search error");
        return;
      }
      
      setSearchResults(data.patients || []);
    } catch {
      setSearchError("Server connection error");
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  // ─── Pull patient into workspace ──────────────────
  const pullPatientToWorkspace = (patient: any) => {
    // No duplicar
    if (workspace.some((p) => p.id === patient.id)) {
      setSelectedPatientId(patient.id);
      setShowSearch(false);
      return;
    }
    setWorkspace(prev => [...prev, patient]);
    setSelectedPatientId(patient.id);
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  // ─── Remove patient from workspace ───────────────
  const removeFromWorkspace = (patientId: string) => {
    setWorkspace(prev => prev.filter(p => p.id !== patientId));
    if (selectedPatientId === patientId) {
      setSelectedPatientId(workspace.find(p => p.id !== patientId)?.id || null);
      setMessages([]);
    }
  };

  // ─── Chat (segments-based stream) ─────────────────
  // ─── Chat (segments-based stream) ─────────────────
  const sendMessage = async (eventOrText?: any) => {
    // Verificamos si la función fue llamada por el sistema (string) o por un clic del usuario (evento)
    const isAutoResume = typeof eventOrText === 'string';
    let textToSend = isAutoResume ? eventOrText : input;
    
    if (!textToSend.trim() && pendingAttachments.length === 0) return;

    setLoading(true);

    const attachmentsToProcess = [...pendingAttachments];
    const initialAttachments: Attachment[] = (!isAutoResume && attachmentsToProcess.length > 0) 
      ? attachmentsToProcess.map(file => ({
          type: "audio",
          name: file.name,
          url: URL.createObjectURL(file), 
          isTranscribing: true
        }))
      : [];

    // What the doctor will see in the chat
    const displayContent = isAutoResume 
      ? "✅ Permissions granted. Retrying operation..." 
      : input;

    // Optimistic UI Update
    const tempMsgId = Date.now().toString();
    if (!isAutoResume) {
      const newMsg: ChatMessage = { id: tempMsgId, role: "user", content: displayContent, attachments: initialAttachments.length > 0 ? initialAttachments : undefined };
      setMessages(prev => [...prev, newMsg]);
      setInput("");
      setPendingAttachments([]);
    }

    let combinedTranscription = "";
    let finalAttachments = [...initialAttachments];

    // Process attachments (e.g. transcription) in background
    if (!isAutoResume && attachmentsToProcess.length > 0) {
      try {
        for (let i = 0; i < attachmentsToProcess.length; i++) {
          const file = attachmentsToProcess[i];
          if (file.type.startsWith('audio/')) {
            const transcription = await processAudioFile(file);
            finalAttachments[i] = {
              ...finalAttachments[i],
              transcription: transcription,
              isTranscribing: false
            };
            combinedTranscription += (combinedTranscription ? "\n" : "") + `[Audio file: ${file.name}]\nTranscription: ${transcription}`;
          }
        }

        // Actualizar el UI de nuevo con la transcripción
        setMessages(prev => {
          const newMessages = [...prev];
          const lastUserIdx = newMessages.map(m => (m as any).id).lastIndexOf(tempMsgId);
          if (lastUserIdx !== -1) {
            const lastMsg = newMessages[lastUserIdx];
            if (lastMsg.role === "user") {
              newMessages[lastUserIdx] = {
                ...lastMsg,
                attachments: finalAttachments
              };
            }
          }
          return newMessages;
        });

      } catch (error) {
        console.error("Error processing attachments:", error);
        alert("There was an error processing the audio files.");
        setLoading(false);
        return;
      }
    }

    // Add the transcription to the text sent to the AI
    if (combinedTranscription) {
      textToSend += (textToSend ? "\n\n" : "") + combinedTranscription;
    }

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Enviamos el texto (con transcripciones) al backend
        body: JSON.stringify({ message: textToSend, patientId: selectedPatientId }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorData = await res.text();
        console.error("Fetch error:", res.status, errorData);
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        console.error("No response body reader");
        setLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      // Create agent message with an initial empty text segment only if it's a new flow
      if (!isAutoResume) {
        setMessages(prev => [...prev, { role: "agent", segments: [{ type: "text", content: "" }] }]);
      }

      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.type === 'chunk') {
                    setMessages(prev => {
                      if (prev.length === 0) return prev;
                      const newMsgs = [...prev];
                      const lastMsg = newMsgs[newMsgs.length - 1];
                      if (lastMsg.role === 'agent') {
                        const segs = [...lastMsg.segments];
                        const lastSeg = segs[segs.length - 1];
                        if (lastSeg && lastSeg.type === 'text') {
                          segs[segs.length - 1] = { ...lastSeg, content: lastSeg.content + (data.content || '') };
                        } else {
                          segs.push({ type: 'text', content: data.content || '' });
                        }
                        newMsgs[newMsgs.length - 1] = { ...lastMsg, segments: segs };
                      }
                      return newMsgs;
                    });
                  } else if (data.type === 'thought') {
                    setMessages(prev => {
                      if (prev.length === 0) return prev;
                      const newMsgs = [...prev];
                      const lastMsg = newMsgs[newMsgs.length - 1];
                      if (lastMsg.role === 'agent') {
                        const segs = [...lastMsg.segments];
                        const lastSeg = segs[segs.length - 1];
                        if (lastSeg && lastSeg.type === 'thought') {
                          segs[segs.length - 1] = { ...lastSeg, content: lastSeg.content + (data.content || '') };
                        } else {
                          segs.push({ type: 'thought', content: data.content || '' });
                        }
                        newMsgs[newMsgs.length - 1] = { ...lastMsg, segments: segs };
                      }
                      return newMsgs;
                    });
                  } else if (data.type === 'agent_resume') {
                    setMessages(prev => {
                      if (prev.length === 0) return prev;
                      const newMsgs = [...prev];
                      const lastMsg = newMsgs[newMsgs.length - 1];
                      if (lastMsg.role === 'agent') {
                        const segs = [...lastMsg.segments];
                        const openToolIdx = segs.findLastIndex(s => s.type === 'tool_start');
                        if (openToolIdx !== -1) {
                          const openTool = segs[openToolIdx];
                          const hasMatchingEnd = segs.slice(openToolIdx + 1).some(
                            s => s.type === 'tool_end' && s.id === (openTool as any).id
                          );
                          if (!hasMatchingEnd) {
                            segs.push({ type: 'tool_end', id: (openTool as any).id, name: (openTool as any).name, output: '__error__:Failure swallowed silently by Auth0 Wrapper. Check your Google Calendar Token.' });
                            segs.push({ type: 'text', content: '' });
                            newMsgs[newMsgs.length - 1] = { ...lastMsg, segments: segs };
                          }
                        }
                      }
                      return newMsgs;
                    });
                  } else if (data.type === 'tool_start') {
                    setMessages(prev => {
                      if (prev.length === 0) return prev;
                      const newMsgs = [...prev];
                      const lastMsg = newMsgs[newMsgs.length - 1];
                      if (lastMsg.role === 'agent') {
                        const segs = [...lastMsg.segments];
                        segs.push({ type: 'tool_start', id: data.id, name: data.name, params: data.params ?? data.input ?? {} });
                        newMsgs[newMsgs.length - 1] = { ...lastMsg, segments: segs };
                      }
                      return newMsgs;
                    });
                  } else if (data.type === 'tool_end') {
                    setMessages(prev => {
                      if (prev.length === 0) return prev;
                      const newMsgs = [...prev];
                      const lastMsg = newMsgs[newMsgs.length - 1];
                      if (lastMsg.role === 'agent') {
                        const segs = [...lastMsg.segments];
                        segs.push({ type: 'tool_end', id: data.id, name: data.name, output: data.output ?? data.result ?? undefined });
                        segs.push({ type: 'text', content: '' });
                        newMsgs[newMsgs.length - 1] = { ...lastMsg, segments: segs };
                      }
                      return newMsgs;
                    });
                  } else if (data.type === 'interrupt') {
                    setMessages(prev => {
                      if (prev.length === 0) return prev;
                      const newMsgs = [...prev];
                      const lastMsg = newMsgs[newMsgs.length - 1];
                      if (lastMsg.role === 'agent') {
                        const segs = [...lastMsg.segments];
                        const openToolIdx = segs.findLastIndex(s => s.type === 'tool_start');
                        if (openToolIdx !== -1) {
                          const openTool = segs[openToolIdx];
                          const hasMatchingEnd = segs.slice(openToolIdx + 1).some(
                            s => s.type === 'tool_end' && s.id === (openTool as any).id
                          );
                          if (!hasMatchingEnd) {
                            // 🟢 We save the exact reason coming from the backend
                            segs.push({ type: 'tool_end', id: (openTool as any).id, name: (openTool as any).name, output: `__interrupted__:${data.data.reason || 'Authorization Required'}` });
                            segs.push({ type: 'text', content: '' });
                            newMsgs[newMsgs.length - 1] = { ...lastMsg, segments: segs };
                          }
                        }
                      }
                      return newMsgs;
                    });
                    setInterrupt(data.data);
                  } else if (data.type === 'error') {
                    setMessages(prev => {
                      if (prev.length === 0) return prev;
                      const newMsgs = [...prev];
                      const lastMsg = newMsgs[newMsgs.length - 1];
                      if (lastMsg.role === 'agent') {
                        const segs = [...lastMsg.segments];
                        const openToolIdx = segs.findLastIndex(s => s.type === 'tool_start');
                        if (openToolIdx !== -1) {
                          const openTool = segs[openToolIdx];
                          const hasMatchingEnd = segs.slice(openToolIdx + 1).some(
                            s => s.type === 'tool_end' && s.id === (openTool as any).id
                          );
                          if (!hasMatchingEnd) {
                            segs.push({ type: 'tool_end', id: (openTool as any).id, name: (openTool as any).name, output: `__error__:${data.message || 'Unknown error'}` });
                            segs.push({ type: 'text', content: '' });
                            newMsgs[newMsgs.length - 1] = { ...lastMsg, segments: segs };
                          }
                        } else {
                          segs.push({ type: 'text', content: `\n\n❌ **Critical System Error:** ${data.message || 'Orchestration failure'}` });
                          newMsgs[newMsgs.length - 1] = { ...lastMsg, segments: segs };
                        }
                      }
                      return newMsgs;
                    });
                  } else if (data.type === 'debug') {
                    console.info(`[SERVER-DEBUG] ${data.message}`);
                  }
                } catch (e) {
                  // Ignore invalid JSON lines
                }
              }
            }
          }
        } catch (e) {
          console.error('Stream processing error:', e);
        }
      };

      await processStream();
    } catch (e) {
      console.error('Send message error:', e);
    } finally {
      setLoading(false);
      setAbortController(null);
    }
  };

  const stopStreaming = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setLoading(false);
      
      setMessages(prev => {
        const newMsgs = [...prev];
        const lastMsg = newMsgs[newMsgs.length - 1];
        if (lastMsg?.role === 'agent') {
          const segs = [...lastMsg.segments];
          segs.push({ type: 'text', content: "\n\n⚠️ *Generation canceled by user.*" });
          newMsgs[newMsgs.length - 1] = { ...lastMsg, segments: segs };
        }
        return newMsgs;
      });
    }
  };

  const handleInterruptResolved = () => {
    setInterrupt(null);
    
    // 🔥 THE MAGIC OF AUTO-RESUME
    sendMessage("[SYSTEM: The user has granted Google Workspace permissions in the Token Vault. Please retry executing the tool immediately.]");
  };

  const handleSelectPatient = (patientId: string) => {
    setSelectedPatientId(patientId);
    setMessages([]);
  };

  const processAudioFile = async (file: File): Promise<string> => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      return data.text;
    } catch (error) {
      console.error("Transcription error:", error);
      throw error;
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingAttachments((prev) => [...prev, file]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Previene ráfagas de renders cuando se arrastra sobre hijos
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (loading || !!interrupt || isTranscribing) return;

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      setPendingAttachments((prev) => [...prev, file]);
    } else if (file) {
      alert("Please drag a valid audio file (.mp3, .wav, .m4a, etc).");
    }
  };

  return (
    <div className="flex h-screen bg-[#020617] text-slate-100 p-4 gap-4 overflow-hidden relative">
      {/* Background */}
      <div className="absolute top-0 right-[25%] w-[30%] h-[30%] bg-primary-600/10 blur-[100px] rounded-full pointer-events-none" />
      
      {/* ═══════════════════════════════════════════════════
          LEFT PANEL: My Workspace
          ═══════════════════════════════════════════════════ */}
      <div className="w-[340px] glass-panel rounded-2xl flex flex-col overflow-hidden relative z-10 flex-shrink-0">
        {/* Header */}
        <div className="p-5 border-b border-slate-800/60 bg-slate-900/30">
           <div className="flex items-center gap-3 mb-3">
             <ShieldCheck className="w-5 h-5 text-cyan-400" />
             <h1 className="text-lg font-light text-slate-100 tracking-wide">MediLink <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-primary-500">AI Scribe</span></h1>
           </div>
           <div className="flex items-center gap-2 text-xs text-slate-500">
             <Activity className="w-3 h-3"/>
             <span>Secure FHIR R4 Connection</span>
             <span className="mx-1 text-slate-700">•</span>
             <Users className="w-3 h-3"/>
             <span>{workspace.length} in Workspace</span>
           </div>
        </div>

        {/* Buscar Patient Button */}
        <div className="px-4 py-3 border-b border-slate-800/40">
          <button
            onClick={() => setShowSearch(true)}
            className="w-full h-9 flex items-center gap-2 px-3 rounded-lg bg-primary-600/10 border border-primary-500/20 text-primary-400 text-xs font-semibold hover:bg-primary-600/20 hover:border-primary-500/40 transition-all cursor-pointer group"
          >
            <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-200" />
            <span>Search Patient in FHIR</span>
          </button>
        </div>

        {/* Filter for workspace */}
        {workspace.length > 3 && (
          <div className="px-4 py-2 border-b border-slate-800/30">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
              <input
                type="text"
                placeholder="Filter..."
                value={workspaceFilter}
                onChange={(e) => setWorkspaceFilter(e.target.value)}
                className="w-full h-7 bg-slate-950/40 rounded-md pl-7 pr-2 text-[11px] border border-slate-800/40 outline-none focus:border-slate-700 transition-all text-slate-300 placeholder:text-slate-700"
              />
            </div>
          </div>
        )}

        {/* Patient List (Workspace) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {workspace.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 px-6 gap-4">
              <div className="p-4 bg-slate-900/30 rounded-2xl border border-dashed border-slate-800">
                <Stethoscope className="w-8 h-8 opacity-30" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-500 mb-1">Empty Workspace</p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Use the <span className="text-primary-400 font-medium">"Add Patient"</span> button to search and add patients to your session.
                </p>
              </div>
              <div className="flex items-start gap-2 bg-slate-900/30 rounded-lg p-3 border border-slate-800/40 mt-2">
                <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  <span className="text-emerald-400 font-semibold">Minimum Necessary:</span> Only explicitly requested patients are loaded, complying with HIPAA and zero-trust standards.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-2 flex flex-col gap-1">
              {filteredWorkspace.map((patient: any, index: number) => {
                const isSelected = patient.id === selectedPatientId;
                const displayName = getPatientDisplayName(patient);
                const initials = getPatientInitials(patient);
                const age = getAge(patient.birthDate);
                
                return (
                  <div
                    key={patient.id}
                    className={`group w-full text-left p-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${
                      isSelected
                        ? "bg-primary-600/15 border border-primary-500/30 shadow-lg shadow-primary-500/5"
                        : "hover:bg-slate-800/40 border border-transparent"
                    }`}
                  >
                    {/* Clickable area */}
                    <button
                      onClick={() => handleSelectPatient(patient.id)}
                      className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                    >
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${getAvatarColor(index)} flex items-center justify-center text-[11px] font-bold text-white shrink-0 shadow-md`}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className={`text-[13px] font-semibold truncate transition-colors ${isSelected ? "text-primary-300" : "text-slate-200 group-hover:text-white"}`}>
                          {displayName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-500">{patient.gender === "male" ? "♂" : "♀"} {age}</span>
                          {getPatientCity(patient) && (
                            <span className="text-[10px] text-slate-600">• {getPatientCity(patient)}</span>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Remove / Selection indicator */}
                    {isSelected ? (
                      <div className="w-2 h-2 rounded-full bg-primary-400 shrink-0 animate-pulse" />
                    ) : (
                      <button
                        onClick={() => removeFromWorkspace(patient.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-800 rounded-md transition-all cursor-pointer"
                        title="Remove from workspace"
                      >
                        <X className="w-3 h-3 text-slate-600 hover:text-slate-400" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Patient Detail Footer */}
        {selectedPatient && (
          <div className="border-t border-slate-800/60 bg-slate-900/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Active Patient</span>
            </div>
            
            <div className="space-y-2">
              <div>
                <p className="text-sm font-bold text-slate-100 leading-tight">{getPatientDisplayName(selectedPatient)}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {selectedPatient.id?.slice(0, 20)}…</p>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-950/40 rounded-lg px-2.5 py-1.5 border border-slate-800/50">
                  <span className="text-slate-500 block text-[9px] uppercase tracking-wider">DOB</span>
                  <span className="text-slate-300">{selectedPatient.birthDate || "—"}</span>
                </div>
                <div className="bg-slate-950/40 rounded-lg px-2.5 py-1.5 border border-slate-800/50">
                  <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Gender</span>
                  <span className="text-slate-300 capitalize">{selectedPatient.gender || "—"}</span>
                </div>
              </div>

              {(getPatientPhone(selectedPatient) || getPatientCity(selectedPatient)) && (
                <div className="flex flex-wrap gap-2 text-[10px]">
                  {getPatientPhone(selectedPatient) && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <Phone className="w-2.5 h-2.5" /> {getPatientPhone(selectedPatient)}
                    </span>
                  )}
                  {getPatientCity(selectedPatient) && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <MapPin className="w-2.5 h-2.5" /> {getPatientCity(selectedPatient)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Compliance Footer */}
        <div className="px-4 py-2 border-t border-slate-800/40 bg-slate-950/30">
          <div className="flex items-center gap-1.5 text-[9px] text-slate-600">
            <Shield className="w-3 h-3 text-emerald-600" />
            <span>Minimum necessary access • HIPAA §164.502(b)</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          SEARCH MODAL
          ═══════════════════════════════════════════════════ */}
      {showSearch && (
        <div className="fixed inset-0 bg-[#020617]/80 backdrop-blur-sm flex items-start justify-center pt-[12vh] z-50" onClick={() => setShowSearch(false)}>
          <div
            className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl shadow-black/50 w-full max-w-lg mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Header */}
            <div className="p-5 border-b border-slate-800/60">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-primary-400" />
                  <h3 className="text-sm font-bold text-slate-100">Search Patient in FHIR</h3>
                </div>
                <button onClick={() => setShowSearch(false)} className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Patient name, last name, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchPatients()}
                    autoFocus
                    className="w-full h-10 bg-slate-950 rounded-xl pl-10 pr-3 text-sm border border-slate-700/50 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all text-slate-100 placeholder:text-slate-600"
                  />
                </div>
                <button
                  onClick={searchPatients}
                  disabled={searching || searchQuery.trim().length < 2}
                  className="h-10 px-4 bg-primary-600 rounded-xl text-sm font-semibold hover:bg-primary-500 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Search
                </button>
              </div>

              <div className="flex items-center gap-1.5 mt-3 text-[10px] text-slate-600">
                <Shield className="w-3 h-3 text-emerald-600" />
                <span>This query is recorded in the FHIR audit log</span>
              </div>
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
              {searchError && (
                <div className="p-4 flex items-center gap-3 text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {searchError}
                </div>
              )}

              {searching && (
                <div className="p-8 flex flex-col items-center gap-3 text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
                  <span className="text-xs">Querying FHIR Store...</span>
                </div>
              )}

              {!searching && searchResults.length === 0 && searchQuery.length >= 2 && !searchError && (
                <div className="p-8 flex flex-col items-center gap-2 text-slate-600">
                  <Users className="w-6 h-6 opacity-30" />
                  <span className="text-xs">No patients found</span>
                </div>
              )}

              {!searching && searchResults.length === 0 && searchQuery.length < 2 && (
                <div className="p-8 flex flex-col items-center gap-2 text-slate-600">
                  <Search className="w-6 h-6 opacity-20" />
                  <span className="text-xs">Enter at least 2 characters to search</span>
                </div>
              )}

              {searchResults.map((patient, index) => {
                const alreadyInWorkspace = workspace.some(p => p.id === patient.id);
                return (
                  <div key={patient.id} className="px-4 py-3 border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getAvatarColor(index)} flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-md`}>
                      {getPatientInitials(patient)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">{getPatientDisplayName(patient)}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                        <span>{patient.gender === "male" ? "♂ Male" : "♀ Female"}</span>
                        <span>•</span>
                        <span>{getAge(patient.birthDate)}</span>
                        {getPatientCity(patient) && (
                          <>
                            <span>•</span>
                            <span>{getPatientCity(patient)}</span>
                          </>
                        )}
                      </div>
                      <p className="text-[9px] text-slate-600 font-mono mt-0.5">{patient.id}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        pullPatientToWorkspace(patient);
                      }}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                        alreadyInWorkspace
                          ? "bg-slate-800 text-slate-500 border border-slate-700"
                          : "bg-primary-600/20 text-primary-400 border border-primary-500/30 hover:bg-primary-600/30 hover:border-primary-500/50"
                      }`}
                    >
                      {alreadyInWorkspace ? "In Workspace" : "Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          PANEL DERECHO: Z.AI Agent Chat
          ═══════════════════════════════════════════════════ */}
      <div className="flex-1 glass-panel rounded-2xl flex flex-col relative z-10">
        <div className="p-4 px-6 border-b border-slate-800/60 bg-slate-900/30 flex justify-between items-center h-[72px]">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-950 rounded-lg border border-primary-500/20">
                <BrainCircuit className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                 <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    GLM 5.1 Copilot 
                 </h2>
                 <p className="text-xs text-primary-400/80">
                   {selectedPatient 
                     ? `Consulting: ${getPatientDisplayName(selectedPatient)}`
                     : "Select a patient to begin"}
                 </p>
              </div>
           </div>
           
           <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-full border border-slate-800">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-xs text-slate-400 font-medium">{user?.name || user?.email}</div>
           </div>
        </div>

        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar relative"
        >
          {messages.length === 0 && (
             <div className="flex-1 flex flex-col items-center justify-center gap-8 py-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="p-5 bg-slate-900/60 rounded-2xl border border-slate-700/30 hero-icon-pulse">
                      <BrainCircuit className="w-10 h-10 text-cyan-400 float-animation" strokeWidth={1.5} />
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#020617] animate-pulse" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-slate-200 tracking-tight">How can I assist you today, Doctor?</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {selectedPatient 
                        ? `Active patient: ${getPatientDisplayName(selectedPatient)}`
                        : "Make a general inquiry or load a patient to view their clinical record."}
                    </p>
                  </div>
                </div>

                <div className={`grid ${selectedPatient ? "grid-cols-2 max-w-2xl" : "grid-cols-1 max-w-md"} gap-3 w-full px-2 mx-auto`}>
                  {AGENTIC_SUGGESTIONS.map((suggestion, index) => {
                    if (!selectedPatient && suggestion.title !== "Consulta Libre GLM 5.1") return null;
                    
                    const Icon = suggestion.icon;
                    return (
                      <button
                        key={index}
                        onClick={() => setInput(suggestion.prompt)}
                        className={`suggestion-card group text-left p-4 rounded-xl bg-gradient-to-br ${suggestion.color} border ${suggestion.borderColor} transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-slate-900/50 cursor-pointer`}
                        style={{ animationDelay: `${index * 100 + 100}ms` }}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg bg-slate-900/50 border border-slate-800/50 ${suggestion.iconColor} shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">{suggestion.title}</h4>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all shrink-0" />
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2 group-hover:text-slate-400 transition-colors">
                              {suggestion.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2 justify-center">
                  { ["FHIR R4", "Zero-Trust", "GLM 5.1", "Token Vault"].map((badge) => (
                    <span key={badge} className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 bg-slate-900/50 border border-slate-800/50 px-2.5 py-1 rounded-full">
                      {badge}
                    </span>
                  ))}
                </div>
             </div>
          )}
          
          {messages.map((m, i) => (
             <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-lg ${
                  m.role === 'user' 
                  ? 'bg-primary-600 text-white rounded-tr-sm' 
                  : 'bg-slate-800/80 text-slate-200 border border-slate-700/50 rounded-tl-sm'
                }`}>
                   <div className="mb-1 text-[10px] uppercase tracking-wider font-bold opacity-60 flex items-center gap-1">
                      {m.role === 'user' ? <User className="w-3 h-3"/> : <BrainCircuit className="w-3 h-3"/>}
                      {m.role === 'user' ? 'Medical Professional' : 'GLM 5.1'}
                   </div>
                   {m.role === 'user' ? (
                     <div className="space-y-3">
                       <div className="whitespace-pre-wrap">{m.content}</div>
                       {m.attachments && m.attachments.length > 0 && (
                         <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-white/10">
                           {m.attachments.map((att, attIdx) => (
                             <div key={attIdx} className="bg-white/10 rounded-xl p-3 border border-white/15 hover:bg-white/[0.12] transition-colors">
                               <div className="flex items-center justify-between gap-3 mb-2">
                                  <div className="flex items-center gap-2">
                                     <div className="p-2 bg-primary-500/20 rounded-lg">
                                       <Mic className="w-4 h-4 text-cyan-300" />
                                     </div>
                                     <div className="flex-1 min-w-0">
                                       <p className="text-[11px] font-bold truncate text-white">{att.name}</p>
                                       <p className="text-[9px] opacity-60 text-slate-100 uppercase tracking-widest font-semibold font-sans">Audit Log Ready</p>
                                     </div>
                                  </div>
                                  {att.transcription && (
                                     <button 
                                       onClick={() => toggleTranscription(i, attIdx)}
                                       className="px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-[10px] font-bold transition-all cursor-pointer text-white flex items-center gap-1"
                                     >
                                       {expandedTranscriptions[`${i}-${attIdx}`] ? "Hide" : "View Transcription"}
                                     </button>
                                  )}
                               </div>
                               
                               {/* Audio Player (Simplified style) */}
                               {att.url && (
                                  <div className="relative">
                                    <audio src={att.url} controls className={`w-full h-8 ${att.isTranscribing ? 'opacity-30 pointer-events-none' : 'opacity-80'}`} />
                                    {att.isTranscribing && (
                                      <div className="absolute inset-0 flex items-center justify-center gap-2">
                                        <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                                        <span className="text-xs font-bold text-cyan-400 drop-shadow-md">Transcribing...</span>
                                      </div>
                                    )}
                                  </div>
                               )}

                               {/* Transcription Reveal */}
                               {att.transcription && expandedTranscriptions[`${i}-${attIdx}`] && (
                                 <div className="mt-3 p-3 bg-black/30 rounded-xl text-xs leading-relaxed border border-white/10 animate-in fade-in slide-in-from-top-1 duration-200">
                                   <div className="flex items-center gap-1.5 mb-2 opacity-60 border-b border-white/10 pb-1.5">
                                      <ClipboardList className="w-3 h-3" />
                                      <p className="text-[9px] font-bold uppercase tracking-[0.15em]">Z.AI Transcription (Zero-Click)</p>
                                   </div>
                                   <div className="text-slate-100 italic">
                                     {att.transcription}
                                   </div>
                                 </div>
                               )}
                             </div>
                           ))}
                         </div>
                       )}
                     </div>
                   ) : (
                     <div className="text-sm">
                       {m.segments.map((seg, sIdx) => {
                         if (seg.type === 'text' && seg.content.trim()) {
                           return (
                             <ReactMarkdown 
                               key={`text-${sIdx}`}
                               remarkPlugins={[remarkGfm]}
                               components={{
                                 h3: ({node, ...props}: any) => <h3 className="text-sm font-bold text-slate-100 mt-4 mb-2 uppercase tracking-wide" {...props} />,
                                 h4: ({node, ...props}: any) => <h4 className="text-sm font-semibold text-slate-200 mt-3 mb-1" {...props} />,
                                 p: ({node, ...props}: any) => <p className="mb-3 last:mb-0 leading-relaxed" {...props} />,
                                 ul: ({node, ...props}: any) => <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />,
                                 ol: ({node, ...props}: any) => <ol className="list-decimal pl-5 mb-4 space-y-1" {...props} />,
                                 li: ({node, ...props}: any) => <li className="text-slate-300" {...props} />,
                                 table: ({node, ...props}: any) => <div className="overflow-x-auto w-full my-4 rounded-xl border border-slate-700/50 bg-slate-900/30"><table className="w-full text-left border-collapse text-xs" {...props} /></div>,
                                 th: ({node, ...props}: any) => <th className="bg-slate-800 p-3 font-semibold text-slate-200 border-b border-slate-700/50 text-xs" {...props} />,
                                 td: ({node, ...props}: any) => <td className="p-3 border-b border-slate-700/50 text-slate-300 last:border-0" {...props} />,
                                 a: ({node, ...props}: any) => <a className="text-primary-400 hover:text-primary-300 underline" target="_blank" rel="noreferrer" {...props} />,
                                 strong: ({node, ...props}: any) => <strong className="font-bold text-slate-100" {...props} />,
                                 hr: ({node, ...props}: any) => <hr className="my-4 border-slate-700/50" {...props} />
                               }}
                             >
                               {seg.content}
                             </ReactMarkdown>
                           );
                         }

                         if (seg.type === 'thought' && seg.content.trim()) {
                            return (
                                <div key={`thought-${sIdx}`} className="mb-4 p-3 bg-slate-900/30 border-l-2 border-primary-500/30 rounded-r-lg text-xs italic text-slate-400 leading-relaxed thought-pulse">
                                  <div className="flex items-center gap-1.5 mb-1.5 text-[9px] font-bold uppercase tracking-widest text-primary-400/70">
                                    <BrainCircuit className="w-3 h-3" />
                                    <span>GLM 5.1 Internal Reasoning</span>
                                  </div>
                                  {seg.content}
                                </div>
                            );
                          }

                         if (seg.type === 'tool_start') {
                           const endSeg = m.segments.slice(sIdx + 1).find(
                             (s) => s.type === 'tool_end' && s.id === seg.id
                           );
                           const hasEnd = !!endSeg;

                           // Determine tool state
                           const isInterrupted = hasEnd && endSeg?.type === 'tool_end' && typeof endSeg.output === 'string' && endSeg.output.startsWith('__interrupted__');
                           
                           // If interrupted or orphaned and there's a subsequent attempt at this tool, hide this older block entirely!
                           const isRetried = (isInterrupted || !hasEnd) && m.segments.slice(sIdx + 1).some(s => s.type === 'tool_start' && s.name === seg.name);
                           if (isRetried) {
                             return null;
                           }

                           const interruptReason = isInterrupted ? endSeg.output.split('__interrupted__:')[1] : '';
                           const isError = hasEnd && endSeg?.type === 'tool_end' && typeof endSeg.output === 'string' && endSeg.output.startsWith('__error__');
                           const isFailed = isError; // We separate interrupted from failed
                           const isStillRunning = !hasEnd && loading;
                           // isOrphaned is when it's not loading and has no end and is not interrupted
                           
                           // Try to parse the output for preview (skip special markers)
                           let parsedPreview: any = null;
                           if (hasEnd && !isError && !isInterrupted && endSeg && endSeg.type === 'tool_end' && endSeg.output) {
                             try {
                               const raw = typeof endSeg.output === 'string' ? JSON.parse(endSeg.output) : endSeg.output;
                               parsedPreview = raw;
                             } catch {
                               parsedPreview = null;
                             }
                           }

                           // Determine visual state
                           const isLastMessage = i === messages.length - 1;
                           const showSuccess = hasEnd && !isError && !isInterrupted;
                           const showFailed = isError || (!hasEnd && (!loading || !isLastMessage) && !isInterrupted);
                           const showInterrupted = isInterrupted;
                           const showRunning = !hasEnd && loading && isLastMessage;

                           const errorMsg = isError && endSeg?.type === 'tool_end' ? String(endSeg.output).replace('__error__:', '') 
                                          : showInterrupted ? `Zero-Trust Protection: ${interruptReason}` 
                                          : (!hasEnd && (!loading || !isLastMessage)) ? 'Tool not completed / Orphaned' : '';

                           return (
                             <div key={`ts-${sIdx}`} className="my-3">
                               {/* Tool header */}
                               <div className={`p-2.5 bg-slate-900/60 border ${showFailed ? 'border-red-500/30' : showInterrupted ? 'border-amber-500/40 animate-pulse' : 'border-slate-700/40'} ${showSuccess && parsedPreview ? 'rounded-t-xl border-b-0' : 'rounded-xl'} flex items-center gap-2.5 ${showRunning ? 'animate-pulse' : ''}`}>
                                 <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                                   showSuccess ? 'bg-emerald-950/60 border border-emerald-500/30'
                                   : showFailed ? 'bg-red-950/60 border border-red-500/30'
                                   : showInterrupted ? 'bg-amber-950/60 border border-amber-500/40'
                                   : 'bg-primary-950/60 border border-primary-500/30'
                                 }`}>
                                   {showSuccess ? '✅' : showFailed ? '⚠️' : showInterrupted ? '🔐' : '⚙️'}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                   <span className={`text-xs font-semibold ${
                                     showSuccess ? 'text-emerald-400'
                                     : showFailed ? 'text-red-400'
                                     : showInterrupted ? 'text-amber-400'
                                     : 'text-primary-300'
                                   }`}>
                                     {showRunning ? 'Executing: ' : showInterrupted ? 'Authorization required for ' : ''}{seg.name}
                                   </span>
                                   {(showFailed || showInterrupted) && errorMsg && (
                                     <div className={`text-[10px] mt-0.5 ${showInterrupted ? 'text-amber-400/80 font-bold' : 'text-red-400/70'}`}>
                                       {errorMsg}
                                     </div>
                                   )}
                                   {!showFailed && !showInterrupted && seg.params && Object.keys(seg.params).length > 0 && (
                                     <details className="mt-1 group">
                                       <summary className="text-[10px] text-slate-500 font-mono truncate cursor-pointer hover:text-slate-400 select-none list-none [&::-webkit-details-marker]:hidden flex items-center gap-1 w-max">
                                         <span className="opacity-50 group-open:rotate-90 transition-transform text-[8px]">▶</span>
                                         Parameters ({Object.keys(seg.params).length})
                                       </summary>
                                       <div className="mt-1.5 text-[10px] text-slate-400 font-mono bg-slate-950/50 p-2 rounded max-w-full overflow-x-auto">
                                         {(() => {
                                           let clean = seg.params;
                                           if (clean && clean.input && typeof clean.input === 'string') {
                                             try { clean = { ...clean, input: JSON.parse(clean.input) } } catch(e) {}
                                           }
                                           return <pre className="whitespace-pre-wrap break-all">{JSON.stringify(clean, null, 2)}</pre>;
                                         })()}
                                       </div>
                                     </details>
                                   )}
                                 </div>
                               </div>

                               {/* Parsed output preview */}
                               {showSuccess && parsedPreview && (
                                 <div className="bg-slate-950/60 border border-slate-700/40 rounded-b-xl p-3 space-y-2">
                                   {/* FHIR Clinical Record preview */}
                                   {parsedPreview.patient && (
                                     <div className="space-y-2">
                                       <div className="flex items-center gap-2">
                                         <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                           {(parsedPreview.patient.name?.[0]?.given?.[0]?.[0] || '?')}{(parsedPreview.patient.name?.[0]?.family?.[0] || '?')}
                                         </div>
                                         <div className="flex-1 min-w-0">
                                           <p className="text-xs font-semibold text-slate-200 truncate">
                                             {parsedPreview.patient.name?.[0]?.given?.join(' ') || ''} {parsedPreview.patient.name?.[0]?.family || 'Patient'}
                                           </p>
                                           <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                             <span>{parsedPreview.patient.gender === 'male' ? '♂' : '♀'} {parsedPreview.patient.birthDate || '—'}</span>
                                             {parsedPreview.patient.address?.[0]?.city && (
                                               <span>• {parsedPreview.patient.address[0].city}</span>
                                             )}
                                           </div>
                                         </div>
                                       </div>

                                       {/* Conditions summary */}
                                       {parsedPreview.conditions && parsedPreview.conditions.length > 0 && (
                                         <div className="space-y-1">
                                           <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                             <span>⚠️</span> Conditions ({parsedPreview.conditions.length})
                                           </div>
                                           {parsedPreview.conditions.slice(0, 4).map((c: any, cIdx: number) => {
                                             const condName = c.code?.coding?.[0]?.display || c.code?.text || 'Unspecified condition';
                                             const isActive = c.clinicalStatus?.coding?.[0]?.code === 'active';
                                             return (
                                               <div key={cIdx} className="flex items-center gap-2 text-[11px] bg-slate-900/50 px-2 py-1 rounded-lg">
                                                 <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-red-400' : 'bg-slate-600'}`} />
                                                 <span className="text-slate-300 truncate flex-1">{condName}</span>
                                                 <span className={`text-[9px] font-semibold uppercase ${isActive ? 'text-red-400' : 'text-slate-600'}`}>
                                                   {isActive ? 'Active' : c.clinicalStatus?.coding?.[0]?.code || '—'}
                                                 </span>
                                               </div>
                                             );
                                           })}
                                           {parsedPreview.conditions.length > 4 && (
                                             <div className="text-[10px] text-slate-600 pl-4">
                                               +{parsedPreview.conditions.length - 4} more...
                                             </div>
                                           )}
                                         </div>
                                       )}
                                       {(!parsedPreview.conditions || parsedPreview.conditions.length === 0) && (
                                         <div className="text-[10px] text-slate-600 italic">No registered conditions</div>
                                       )}
                                     </div>
                                   )}

                                   {/* Google Calendar event preview */}
                                   {(parsedPreview.htmlLink || parsedPreview.summary) && !parsedPreview.patient && (
                                     <div className="flex items-center gap-2">
                                       <span className="text-sm">📅</span>
                                       <div className="flex-1 min-w-0">
                                         <p className="text-xs font-semibold text-slate-200 truncate">{parsedPreview.summary || 'Event created'}</p>
                                         {parsedPreview.start?.dateTime && (
                                           <p className="text-[10px] text-slate-500">{new Date(parsedPreview.start.dateTime).toLocaleString('en-US')}</p>
                                         )}
                                       </div>
                                     </div>
                                   )}

                                   {/* Generic JSON fallback — if not FHIR patient and not Calendar */}
                                   {!parsedPreview.patient && !parsedPreview.htmlLink && !parsedPreview.summary && (
                                     parsedPreview.lc === 1 || parsedPreview.type === "constructor" ? (
                                       <details className="group">
                                         <summary className="text-[11px] text-slate-400 italic px-2 py-1 cursor-pointer hover:text-slate-300 select-none list-none [&::-webkit-details-marker]:hidden flex items-center gap-1 w-max">
                                           <span className="opacity-50 group-open:rotate-90 transition-transform text-[9px]">▶</span>
                                           Operation completed in the integrated system.
                                         </summary>
                                         <div className="text-[10px] text-slate-500 font-mono bg-slate-900/40 p-2 rounded-xl mt-1 border border-slate-700/30 overflow-x-auto max-w-full">
                                           <pre className="whitespace-pre-wrap break-all">{JSON.stringify(parsedPreview, null, 2)}</pre>
                                         </div>
                                       </details>
                                     ) : (
                                       <pre className="text-[10px] text-slate-500 font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto max-w-full leading-tight">
                                         {JSON.stringify(parsedPreview, null, 2).slice(0, 400)}{JSON.stringify(parsedPreview, null, 2).length > 400 ? '\n...' : ''}
                                       </pre>
                                     )
                                   )}
                                 </div>
                               )}

                               {/* Non-JSON string output  */}
                               {showSuccess && !parsedPreview && endSeg && endSeg.type === 'tool_end' && endSeg.output && (
                                 <div className="bg-slate-950/60 border border-slate-700/40 border-t-0 rounded-b-xl p-2">
                                   <p className="text-[10px] text-slate-500 font-mono whitespace-pre-wrap max-h-16 overflow-hidden">
                                     {String(endSeg.output).slice(0, 300)}{String(endSeg.output).length > 300 ? '...' : ''}
                                   </p>
                                 </div>
                               )}
                             </div>
                           );
                         }

                         // tool_end segments are rendered within their matching tool_start above
                         return null;
                       })}
                     </div>
                   )}
                </div>
             </div>
          ))}
          
          {loading && (
             <div className="flex justify-start">
                <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl rounded-tl-sm flex items-center gap-3 shadow-lg">
                   <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                   </div>
                   <span className="text-xs text-primary-300/80 font-medium">GLM 5.1 is reasoning (stream active)...</span>
                </div>
             </div>
          )}
        </div>

        {interrupt && (
           <div className="absolute inset-0 bg-[#020617]/85 flex items-center justify-center p-6 backdrop-blur-xl z-50 rounded-2xl">
              <div className="bg-gradient-to-b from-slate-900 to-slate-950 p-0 rounded-2xl border border-slate-700/40 shadow-[0_0_80px_rgba(16,185,129,0.08),_0_0_30px_rgba(0,0,0,0.5)] flex flex-col max-w-sm w-full relative overflow-hidden">
                 {/* Top accent bar */}
                 <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />
                 
                 {/* Header section */}
                 <div className="px-6 pt-6 pb-4">
                    <div className="flex items-center gap-4">
                       <div className="relative">
                          <div className="p-3 bg-emerald-950/60 rounded-xl border border-emerald-500/20">
                             <ShieldAlert className="w-6 h-6 text-emerald-400" />
                          </div>
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-slate-900 animate-pulse" />
                       </div>
                       <div className="flex-1 min-w-0">
                          <h3 className="text-white text-base font-bold tracking-tight">Authorization Required</h3>
                          <p className="text-[10px] text-emerald-400/70 uppercase tracking-[0.2em] font-semibold mt-0.5">Token Vault · Zero-Trust</p>
                       </div>
                    </div>
                 </div>

                 {/* Reason section */}
                 <div className="px-6 pb-4">
                    <div className="bg-slate-800/40 border border-slate-700/40 p-3.5 rounded-xl">
                       <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold mb-1.5">Reason</p>
                       <p className="text-sm text-slate-300 leading-relaxed">
                         {interrupt.reason || 'Access to Google Workspace is required to complete this clinical action.'}
                       </p>
                    </div>
                 </div>

                 {/* Scopes section */}
                 {interrupt.scopes && interrupt.scopes.length > 0 && (
                    <div className="px-6 pb-4">
                       <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold mb-2">Requested Permissions</p>
                       <div className="flex flex-wrap gap-1.5">
                          {interrupt.scopes.map((scope: string, i: number) => {
                             const label = scope.includes('calendar') ? '📅 Calendar Events' : scope.split('/').pop();
                             return (
                                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800/60 border border-slate-700/40 rounded-lg text-[11px] text-slate-300 font-mono">
                                  {label}
                                </span>
                             );
                          })}
                       </div>
                    </div>
                 )}

                 {/* Auth0 Consent Widget */}
                 <div className="px-6 pb-4">
                    <TokenVaultInterruptHandler interrupt={interrupt} onResolved={handleInterruptResolved} />
                 </div>

                 {/* Footer */}
                 <div className="px-6 pb-5 flex items-center justify-between">
                    <button 
                       onClick={() => setInterrupt(null)} 
                       className="text-[11px] font-medium text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                       Cancel
                    </button>
                    <div className="flex items-center gap-1.5">
                       <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                       <span className="text-[10px] text-slate-600 font-mono">Auth0 Token Vault</span>
                    </div>
                 </div>
              </div>
           </div>
        )}

        <div 
          className="p-4 bg-slate-900/30 border-t border-slate-800/60 min-h-[80px] relative transition-colors duration-200"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Floating Scroll to Bottom Button */}
          {showScrollButton && (
             <div className="absolute -top-12 left-0 right-0 flex justify-center z-20">
               <button
                 onClick={scrollToBottom}
                 className="flex items-center gap-2 px-4 py-1.5 bg-slate-900 border border-primary-500/30 text-primary-400 rounded-full shadow-lg hover:bg-slate-800 hover:border-primary-500/50 transition-all active:scale-95 group cursor-pointer"
               >
                 <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                 <span className="text-[10px] font-bold uppercase tracking-wider">Scroll Down</span>
               </button>
             </div>
          )}

          {/* Drag & Drop Overlay for Input Area */}
          {isDragging && (
            <div className="absolute inset-0 z-[100] bg-slate-950/95 backdrop-blur-md border-t-2 border-primary-500/80 flex flex-col items-center justify-center pointer-events-none transition-all duration-200 shadow-[inset_0_20px_50px_rgba(6,182,212,0.05)] rounded-b-2xl">
               <div className="flex items-center gap-4 animate-in zoom-in-95 duration-200">
                 <div className="bg-slate-800/80 p-3 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.3)] border border-primary-500/40">
                   <Mic className="w-6 h-6 text-cyan-400 animate-pulse" />
                 </div>
                 <div>
                   <h3 className="text-base font-bold text-white tracking-tight">Drop here to attach file</h3>
                   <p className="text-primary-300/80 text-xs mt-0.5">The note will not be sent until you press Enter</p>
                 </div>
               </div>
            </div>
          )}

           <div className={`max-w-4xl mx-auto flex flex-col gap-3 transition-opacity duration-200 ${isDragging ? 'opacity-0' : 'opacity-100'}`}>
              {/* Pending Attachments List */}
              {pendingAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {pendingAttachments.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-lg px-3 py-1.5 group hover:border-primary-500/30 transition-all">
                      {file.type.startsWith('audio/') ? <Mic className="w-3.5 h-3.5 text-cyan-400" /> : <Paperclip className="w-3.5 h-3.5 text-slate-400" />}
                      <span className="text-[11px] font-medium text-slate-300 truncate max-w-[150px]">{file.name}</span>
                      <button 
                        onClick={() => removeAttachment(idx)} 
                        className="p-0.5 hover:bg-slate-700 rounded transition-colors text-slate-500 hover:text-red-400 cursor-pointer"
                        title="Remove attachment"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 items-center relative">
                {/* Hidden file input for audio upload */}
                <input 
                  type="file" 
                  accept="audio/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleAudioUpload}
                />

                {/* Main Input Container with integrated Paperclip */}
                <div className="flex-1 relative flex items-center">
                  <div className="absolute left-1.5 z-10">
                    <button 
                      onClick={() => setShowAttachMenu(!showAttachMenu)}
                      disabled={loading || !!interrupt || isTranscribing}
                      className={`h-9 w-9 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                        showAttachMenu 
                          ? 'bg-primary-600/20 text-primary-400' 
                          : 'text-slate-500 hover:text-cyan-400 hover:bg-slate-800/60'
                      } disabled:opacity-50`}
                      title="Attach clinical resources"
                    >
                      {isTranscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                    </button>

                    {/* 📎 ATTACH MENU (Inside the container) */}
                    {showAttachMenu && (
                      <div className="absolute bottom-full left-0 mb-4 w-52 bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl p-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <div className="p-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800/50 mb-1">
                          Attach Resource
                        </div>
                        
                        <button 
                          disabled
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 cursor-not-allowed opacity-50 text-xs text-left"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Document(GCP)</span>
                        </button>

                        <button 
                          onClick={() => {
                            setShowAttachMenu(false);
                            fileInputRef.current?.click();
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-primary-600/20 hover:text-primary-400 transition-colors text-xs text-left cursor-pointer"
                        >
                          <Mic className="w-4 h-4 text-cyan-400" />
                          <div className="flex-1">
                            <p className="font-semibold">Voice Note</p>
                            <p className="text-[9px] text-slate-500">Z.AI GLM-ASR-2512</p>
                          </div>
                        </button>

                        <button 
                          disabled
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 cursor-not-allowed opacity-50 text-xs text-left"
                        >
                          <Image className="w-4 h-4" />
                          <span>Image (Vision AI)</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <input 
                    type="text" 
                    className="w-full h-12 bg-slate-950 rounded-xl pl-12 pr-4 text-sm border border-slate-700/50 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all text-slate-100 placeholder:text-slate-600 shadow-inner"
                    placeholder={isTranscribing 
                        ? "Processing audio with Z.AI..." 
                        : selectedPatient 
                      ? `Query about ${getPatientDisplayName(selectedPatient)}...` 
                      : "Perform a medical inquiry or attach audio..."}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    disabled={isTranscribing}
                  />
                </div>

                <button 
                  className={`h-12 w-12 flex items-center justify-center rounded-xl transition-all shadow-xl group cursor-pointer ${
                    loading 
                    ? 'bg-slate-800 border-2 border-red-500/30' 
                    : 'bg-primary-600 hover:bg-primary-500 shadow-primary-500/20 disabled:opacity-50'
                  }`}
                  onClick={loading ? stopStreaming : sendMessage}
                  disabled={(!loading && !input.trim() && pendingAttachments.length === 0) || !!interrupt}
                  title={loading ? "Cancel generation" : "Send query"}
                >
                  {loading ? (
                    <div className="relative flex items-center justify-center">
                      <Square className="w-4 h-4 text-red-500 fill-red-500 animate-pulse" />
                      <Loader2 className="absolute w-7 h-7 text-red-400 animate-spin opacity-40" />
                    </div>
                  ) : (
                    <Send className="w-5 h-5 text-white/90 group-hover:text-white group-hover:translate-x-0.5 transition-transform" />
                  )}
                </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
