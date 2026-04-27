import * as React from "react";

interface GuidianLogoProps {
  size?: number;
  strokeColor?: string;
  accentColor?: string;
  className?: string;
}

export function GuidianLogo({
  size = 28,
  strokeColor = "white",
  accentColor = "#C98A2A",
  className,
}: GuidianLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* Compass ring */}
      <circle cx="14" cy="14" r="12.5" stroke={strokeColor} strokeWidth="1.5" />
      {/* Amber accent dots at compass points */}
      <circle cx="14" cy="1.5" r="1.5" fill={accentColor} />
      <circle cx="26.5" cy="14" r="1.5" fill={accentColor} />
      <circle cx="14" cy="26.5" r="1.5" fill={accentColor} />
      <circle cx="1.5" cy="14" r="1.5" fill={accentColor} />
      {/* G letterform: large arc with horizontal crossbar */}
      <path
        d="M 20.5 10.5 A 7.5 7.5 0 1 0 20.5 17.5 H 14 V 14"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
