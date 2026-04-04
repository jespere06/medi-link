import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface PromptUserContainerProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    className?: string;
  };
  icon?: React.ReactNode;
  readOnly?: boolean;
  containerClassName?: string;
}

export function PromptUserContainer({
  title,
  description,
  action,
  icon,
  readOnly = false,
  containerClassName,
}: PromptUserContainerProps) {
  return (
    <fieldset
      className={cn(
        "border border-slate-700/50 bg-slate-800/30 rounded-xl items-center w-full justify-between p-5 flex flex-col gap-4",
        { "disabled cursor-not-allowed opacity-50": readOnly },
        containerClassName
      )}
      disabled={readOnly}
    >
      <div className="w-full flex flex-col justify-start items-start gap-3">
        {icon}
        <div className="flex flex-col gap-1.5 items-start w-full">
          <h2 className="text-sm font-semibold text-slate-200 leading-snug">
            {title}
          </h2>
          {description && (
            <p className="text-xs leading-relaxed text-slate-400">
              {description}
            </p>
          )}
        </div>
      </div>

      {action && (
        <div className="w-full">
          <button
            onClick={() => action.onClick()}
            className={cn(
              "w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-lg text-sm py-3 px-5",
              "hover:from-emerald-500 hover:to-teal-500 hover:shadow-lg hover:shadow-emerald-500/20",
              "active:scale-[0.98] transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
              "disabled:pointer-events-none disabled:opacity-50",
              action.className
            )}
          >
            {action.label}
          </button>
        </div>
      )}
    </fieldset>
  );
}

