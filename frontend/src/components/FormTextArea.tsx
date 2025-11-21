import React from 'react';

interface FormTextAreaProps {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
}

/**
 * フォームテキストエリアコンポーネント
 * ラベル付きのテキストエリアを表示する共通コンポーネント
 */
export const FormTextArea: React.FC<FormTextAreaProps> = ({
  id,
  name,
  label,
  value,
  onChange,
  placeholder,
  required = false,
  error,
  rows = 4,
  className = '',
  disabled = false,
}) => {
  return (
    <div className={`mb-6 ${className}`}>
      <label htmlFor={id} className="block text-aws-squid-ink-light dark:text-aws-font-color-white-dark font-medium mb-2">
        {label} {required && <span className="text-red">*</span>}
      </label>
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        rows={rows}
        className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-aws-sea-blue-light ${
          error ? 'border-red' : 'border-light-gray'
        }`}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
      {error && (
        <p className="mt-1 text-red text-sm">{error}</p>
      )}
    </div>
  );
};

export default FormTextArea;
