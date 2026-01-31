import React from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface FormSelectProps {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: SelectOption[];
  required?: boolean;
  error?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * フォームセレクトコンポーネント
 * ラベル付きのドロップダウン選択フィールドを表示する共通コンポーネント
 */
export const FormSelect: React.FC<FormSelectProps> = ({
  id,
  name,
  label,
  value,
  onChange,
  options,
  required = false,
  error,
  className = "",
  disabled = false,
}) => {
  return (
    <div className={`mb-6 ${className}`}>
      <label
        htmlFor={id}
        className="block text-aws-squid-ink-light dark:text-aws-font-color-white-dark font-medium mb-2">
        {label} {required && <span className="text-red">*</span>}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-aws-sea-blue-light bg-white dark:bg-aws-squid-ink-light ${
          error ? "border-red" : "border-light-gray"
        }`}
        required={required}
        disabled={disabled}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-red text-sm">{error}</p>}
    </div>
  );
};

export default FormSelect;
