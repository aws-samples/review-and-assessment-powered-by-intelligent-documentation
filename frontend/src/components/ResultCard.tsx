import React from "react";

export type ResultCardVariant = "default" | "success" | "warning" | "error";

interface ResultCardProps {
  variant?: ResultCardVariant;
  children: React.ReactNode;
  className?: string;
  borderAccent?: boolean;
  emphasize?: boolean; // For special emphasis like isBelowThreshold
}

/**
 * Common result card component for displaying items with status-based styling
 * Used across checklist and review features for consistent visual feedback
 */
export const ResultCard: React.FC<ResultCardProps> = ({
  variant = "default",
  children,
  className = "",
  borderAccent = false,
  emphasize = false,
}) => {
  const baseClasses = "rounded-lg border p-4 transition-all duration-200";
  
  const getVariantClasses = () => {
    const accentBorder = borderAccent ? "border-l-4" : "";
    const emphasizeBorder = emphasize ? "border-2" : "";
    
    switch (variant) {
      case "success":
        return `bg-aws-lab bg-opacity-10 hover:bg-aws-lab hover:bg-opacity-30 border-aws-lab ${accentBorder} ${emphasizeBorder}`;
      case "warning":
        const warningBg = emphasize ? "bg-light-yellow hover:bg-yellow-100" : "bg-yellow bg-opacity-10 hover:bg-yellow hover:bg-opacity-20";
        return `${warningBg} border-yellow ${accentBorder} ${emphasizeBorder}`;
      case "error":
        return `bg-red bg-opacity-10 hover:bg-red hover:bg-opacity-20 border-red ${accentBorder} ${emphasizeBorder}`;
      default:
        const defaultBg = emphasize ? "bg-light-yellow hover:bg-yellow-100" : "bg-white hover:bg-aws-paper-light";
        const defaultBorder = emphasize ? "border-yellow" : "border-light-gray";
        return `${defaultBorder} ${defaultBg} ${emphasizeBorder}`;
    }
  };

  return (
    <div className={`${baseClasses} ${getVariantClasses()} ${className}`}>
      {children}
    </div>
  );
};

export default ResultCard;
