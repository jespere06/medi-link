export const WaitingMessage = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 w-full py-4">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-2 border-slate-700" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-500 animate-spin" />
      </div>
      <p className="text-xs text-slate-400 font-medium tracking-wide animate-pulse">
        Esperando autorización...
      </p>
    </div>
  );
};

