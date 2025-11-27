import React from "react";
import Tooltip from "./Tooltip";

interface HelpIconProps {
  content: string;
  position?: "top" | "bottom" | "left" | "right";
}

export default function HelpIcon({ content, position = "top" }: HelpIconProps) {
  return (
    <Tooltip content={content} position={position}>
      <span className="text-xs text-aws-font-color-blue cursor-help underline decoration-dotted">
        ?
      </span>
    </Tooltip>
  );
}
