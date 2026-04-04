"use client";

import { useState } from "react";
import { ShieldCheck, Activity, BrainCircuit, Loader2, Send, AlertTriangle, ShieldAlert, CheckCircle2 } from "lucide-react";
import axios from "axios";

export default function DebugAuthPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<any>(null);

  const testExchange = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    
    try {
      // Intentamos llamar a un endpoint de prueba o simular el canje
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "DEBUG_TOKEN_EXCHANGE_TEST", patientId: "test-id" }),
      });

      const text = await res.text();
      setResult({ status: res.status, body: text });
    } catch (err: any) {
      setError(err.message || "Error de red");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 p-8 flex flex-col items-center justify-center gap-8">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-primary-600/5 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="max-w-2xl w-full space-y-6 relative z-10">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-primary-950/60 rounded-2xl border border-primary-500/30">
            <ShieldCheck className="w-8 h-8 text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Token Vault Diagnostics</h1>
            <p className="text-slate-500 text-sm">Validación aislada de Connected Accounts & Token Exchange</p>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 border border-slate-800/60 space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Acción Crítica</label>
            <p className="text-sm text-slate-400 leading-relaxed">
              Este test intenta disparar el flujo de consulta del agente con un comando de depuración. 
              Si no tienes una cuenta de Google vinculada, Auth0 Token Vault debería interceptar la llamada.
            </p>
          </div>

          <button
            onClick={testExchange}
            disabled={loading}
            className="w-full h-12 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-primary-500/10 flex items-center justify-center gap-3 cursor-pointer"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />}
            Ejecutar Diagnóstico de Canje
          </button>
        </div>

        {error && (
          <div className="bg-red-950/30 border border-red-500/30 p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
               <p className="text-sm font-bold text-red-100">Error de Conexión</p>
               <p className="text-xs text-red-400/80 font-mono">{error}</p>
            </div>
          </div>
        )}

        {result && (
          <div className={`p-6 rounded-2xl border animate-in fade-in slide-in-from-top-4 duration-500 ${
            result.status === 200 ? 'bg-emerald-950/20 border-emerald-500/20' : 'bg-slate-900/50 border-slate-700/50'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              {result.status === 200 ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-amber-400" />
              )}
              <h3 className="font-bold text-sm">Respuesta del Servidors</h3>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${
                result.status === 200 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
              }`}>
                HTTP {result.status}
              </span>
            </div>

            <div className="bg-black/40 rounded-xl p-4 border border-slate-800/50 max-h-[300px] overflow-auto custom-scrollbar">
              <pre className="text-[11px] font-mono text-slate-400 whitespace-pre-wrap leading-relaxed">
                {result.status === 200 && result.body.includes("data:") 
                  ? result.body.split("\n").filter((l: string) => l.includes("data:")).map((l: string) => {
                      try {
                        return JSON.stringify(JSON.parse(l.slice(6).trim()), null, 2);
                      } catch {
                        return l;
                      }
                    }).join("\n\n")
                  : result.body
                }
              </pre>
            </div>
            
            <p className="text-[10px] text-slate-600 mt-4 text-center">
              Si ves un evento tipo <code className="text-primary-400">"interrupt"</code> arriba, el sistema de seguridad está funcionando correctamente.
            </p>
          </div>
        )}

        <div className="flex justify-center gap-8 opacity-40">
           <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Auth0 Token Vault</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Next.js 16 Edge</span>
           </div>
        </div>
      </div>
    </div>
  );
}
