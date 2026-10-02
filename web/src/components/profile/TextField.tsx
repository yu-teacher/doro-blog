import React, { useId } from 'react';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'url' | 'email';
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  /** 입력창 아래의 보조 설명. */
  hint?: string;
  /** 입력창 왼쪽에 겹쳐 보여줄 아이콘 (있으면 왼쪽 여백이 늘어난다). */
  icon?: React.ReactNode;
}

const INPUT_CLASS =
  'w-full py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-100';

/** 라벨이 붙은 한 줄 입력칸. */
export const TextField: React.FC<TextFieldProps> = ({ label, value, onChange, type = 'text', required, placeholder, maxLength, hint, icon }) => {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  return (
  <div>
    <label htmlFor={inputId} className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{label}</label>
    <div className="relative">
      <input
        id={inputId}
        aria-describedby={hint ? hintId : undefined}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`${INPUT_CLASS} ${icon ? 'pl-9 pr-3.5' : 'px-3.5'}`}
      />
      {icon && <span aria-hidden="true" className="absolute left-3 top-2.5 text-slate-400">{icon}</span>}
    </div>
    {hint && <span id={hintId} className="text-[11px] text-slate-400 mt-1 block">{hint}</span>}
  </div>
  );
};
