import { auth0 } from '../lib/auth0';
import ClientPage from './client-page';
import { ShieldCheck, Activity, BrainCircuit } from 'lucide-react';

export default async function Page() {
  const session = await auth0.getSession();
  
  if (!session?.user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#020617] text-slate-100 overflow-hidden relative">
        {/* Background Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-600/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="glass-panel p-12 rounded-3xl flex flex-col items-center max-w-2xl w-full mx-4 relative z-10 border border-slate-800/50">
          <div className="bg-slate-900/50 p-4 rounded-2xl mb-8 neon-glow border border-cyan-500/20">
            <ShieldCheck className="w-16 h-16 text-cyan-400" strokeWidth={1.5} />
          </div>
          
          <h1 className="text-5xl font-light tracking-tight mb-4">
            MediLink <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-primary-500">AI Scribe</span>
          </h1>
          
          <p className="text-slate-400 text-center text-lg mb-10 max-w-lg leading-relaxed">
            Advanced clinical automation platform. Integrate native workflows with 
            <span className="text-slate-200 font-medium"> HAPI FHIR</span> and <span className="text-slate-200 font-medium">Z.AI</span>.
          </p>

          <div className="flex w-full flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="/api/auth/login" 
              className="group relative flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl hover:from-primary-500 hover:to-cyan-500 transition-all duration-300 font-semibold shadow-lg shadow-primary-500/20 overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
              <Activity className="w-5 h-5 relative z-10" />
              <span className="relative z-10">Medical Authentication</span>
            </a>
          </div>

          <div className="mt-12 flex gap-8 text-sm text-slate-500">
             <div className="flex items-center gap-2"><BrainCircuit className="w-4 h-4"/> GLM 5.1 Powered</div>
             <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4"/> Auth0 Token Vault</div>
          </div>
        </div>
      </div>
    );
  }

  // Zero-Trust: El consultorio inicia vacío.
  // El médico trae pacientes bajo demanda via /api/patients/search
  // Esto respeta el principio "Minimum Necessary" de HIPAA.
  return <ClientPage user={session.user} />;
}
