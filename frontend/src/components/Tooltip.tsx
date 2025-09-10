import React, { ReactNode, useState } from "react";

interface TooltipProps {
  children: ReactNode;
  content: string;
  position?: "top" | "bottom" | "left" | "right";
}

const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = "top",
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}>
      {children}
      <div
        className={`bg-aws-squid-ink-light pointer-events-none absolute z-50 whitespace-nowrap rounded px-2 py-1 text-sm text-aws-font-color-white-light transition-opacity duration-200 ${isVisible ? "opacity-100" : "opacity-0"} ${position === "top" ? "bottom-full left-1/2 mb-2 -translate-x-1/2 transform before:absolute before:top-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-t-aws-squid-ink-light" : ""} ${position === "bottom" ? "left-1/2 top-full mt-2 -translate-x-1/2 transform before:absolute before:bottom-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-b-aws-squid-ink-light" : ""} ${position === "left" ? "right-full top-1/2 mr-2 -translate-y-1/2 transform before:absolute before:left-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-l-aws-squid-ink-light" : ""} ${position === "right" ? "left-full top-1/2 ml-2 -translate-y-1/2 transform before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-aws-squid-ink-light" : ""} `}
        role="tooltip">
        {content}
      </div>
    </div>
  );
};

export default Tooltip;
