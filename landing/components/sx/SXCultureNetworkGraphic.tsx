'use client'

import React from 'react'

export const SXCultureNetworkGraphic = React.memo(function SXCultureNetworkGraphic() {
  return (
    <svg width="500" height="500" viewBox="0 0 500 500" className="overflow-visible">
      <defs>
        <path id="toCenter1" d="M 102 102 L 250 250" />
        <path id="toCenter2" d="M 398 102 L 250 250" />
        <path id="toCenter3" d="M 102 398 L 250 250" />
        <path id="toCenter4" d="M 398 398 L 250 250" />
        <path id="toCenter5" d="M 250 40 L 250 250" />
        <path id="toCenter6" d="M 460 250 L 250 250" />
        <path id="toCenter7" d="M 250 460 L 250 250" />
        <path id="toCenter8" d="M 40 250 L 250 250" />
      </defs>

      <line x1="102" y1="102" x2="250" y2="250" stroke="var(--st-border)" strokeWidth="2" />
      <line x1="398" y1="102" x2="250" y2="250" stroke="var(--st-border)" strokeWidth="2" />
      <line x1="102" y1="398" x2="250" y2="250" stroke="var(--st-border)" strokeWidth="2" />
      <line x1="398" y1="398" x2="250" y2="250" stroke="var(--st-border)" strokeWidth="2" />
      <line x1="250" y1="40" x2="250" y2="250" stroke="var(--st-border)" strokeWidth="2" />
      <line x1="460" y1="250" x2="250" y2="250" stroke="var(--st-border)" strokeWidth="2" />
      <line x1="250" y1="460" x2="250" y2="250" stroke="var(--st-border)" strokeWidth="2" />
      <line x1="40" y1="250" x2="250" y2="250" stroke="var(--st-border)" strokeWidth="2" />

      <line x1="102" y1="102" x2="250" y2="250" stroke="white" strokeWidth="2" opacity="0">
        <animate attributeName="opacity" values="0;0.2;0" dur="3s" repeatCount="indefinite" />
      </line>
      <line x1="398" y1="102" x2="250" y2="250" stroke="white" strokeWidth="2" opacity="0">
        <animate attributeName="opacity" values="0;0.2;0" dur="3s" repeatCount="indefinite" begin="0.375s" />
      </line>
      <line x1="102" y1="398" x2="250" y2="250" stroke="white" strokeWidth="2" opacity="0">
        <animate attributeName="opacity" values="0;0.2;0" dur="3s" repeatCount="indefinite" begin="0.75s" />
      </line>
      <line x1="398" y1="398" x2="250" y2="250" stroke="white" strokeWidth="2" opacity="0">
        <animate attributeName="opacity" values="0;0.2;0" dur="3s" repeatCount="indefinite" begin="1.125s" />
      </line>
      <line x1="250" y1="40" x2="250" y2="250" stroke="white" strokeWidth="2" opacity="0">
        <animate attributeName="opacity" values="0;0.2;0" dur="3s" repeatCount="indefinite" begin="1.5s" />
      </line>
      <line x1="460" y1="250" x2="250" y2="250" stroke="white" strokeWidth="2" opacity="0">
        <animate attributeName="opacity" values="0;0.2;0" dur="3s" repeatCount="indefinite" begin="1.875s" />
      </line>
      <line x1="250" y1="460" x2="250" y2="250" stroke="white" strokeWidth="2" opacity="0">
        <animate attributeName="opacity" values="0;0.2;0" dur="3s" repeatCount="indefinite" begin="2.25s" />
      </line>
      <line x1="40" y1="250" x2="250" y2="250" stroke="white" strokeWidth="2" opacity="0">
        <animate attributeName="opacity" values="0;0.2;0" dur="3s" repeatCount="indefinite" begin="2.625s" />
      </line>

      <g>
        <circle cx="102" cy="102" r="22" fill="var(--st-border)" opacity="0.8" />
        <g transform="translate(102, 102) scale(0.65) translate(-12, -12)">
          <path d="M2 19h20v3H2zM12 2L2 6v2h20V6M17 10h3v7h-3zM10.5 10h3v7h-3zM4 10h3v7H4z" fill="white" opacity="0.9" />
        </g>

        <circle cx="398" cy="102" r="22" fill="var(--st-border)" opacity="0.8" />
        <g transform="translate(398, 102) scale(0.65)">
          <path d="M -12 9 L -6 3 L 0 6 L 6 -3 L 12 -9" stroke="white" strokeWidth="2" fill="none" opacity="0.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 6 -9 L 12 -9 L 12 -3" stroke="white" strokeWidth="2" fill="none" opacity="0.9" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        <circle cx="102" cy="398" r="22" fill="var(--st-border)" opacity="0.8" />
        <g transform="translate(102, 398) scale(0.65)">
          <circle cx="0" cy="-6" r="5" fill="white" opacity="0.9" />
          <path d="M -9 12 Q -9 3 0 3 Q 9 3 9 12" fill="white" opacity="0.9" />
        </g>

        <circle cx="398" cy="398" r="22" fill="var(--st-border)" opacity="0.8" />
        <g transform="translate(398, 398) scale(0.65)">
          <circle cx="-6" cy="-4.5" r="3.75" fill="white" opacity="0.9" />
          <circle cx="6" cy="-4.5" r="3.75" fill="white" opacity="0.9" />
          <path d="M -12 9 Q -12 1.5 -6 1.5 Q 0 1.5 0 9 M 0 9 Q 0 1.5 6 1.5 Q 12 1.5 12 9" fill="white" opacity="0.9" />
        </g>

        <circle cx="250" cy="40" r="22" fill="var(--st-border)" opacity="0.8" />
        <g transform="translate(250, 40) scale(0.65)">
          <rect x="-3" y="-12" width="6" height="15" rx="3" fill="white" opacity="0.9" />
          <path d="M -6 3 Q -6 7.5 0 7.5 Q 6 7.5 6 3 M 0 7.5 L 0 12 M -4.5 12 L 4.5 12" stroke="white" strokeWidth="1.5" fill="none" opacity="0.9" strokeLinecap="round" />
        </g>

        <circle cx="460" cy="250" r="22" fill="var(--st-border)" opacity="0.8" />
        <g transform="translate(460, 250) scale(0.65)">
          <path d="M 0 12 C -12 0 -12 -9 -4.5 -9 C 0 -9 0 -4.5 0 -4.5 C 0 -4.5 0 -9 4.5 -9 C 12 -9 12 0 0 12 Z" fill="white" opacity="0.9" />
        </g>

        <circle cx="250" cy="460" r="22" fill="var(--st-border)" opacity="0.8" />
        <g transform="translate(250, 460) scale(0.65)">
          <circle cx="0" cy="0" r="10.5" fill="none" stroke="white" strokeWidth="1.5" opacity="0.9" />
          <circle cx="0" cy="0" r="3.75" fill="white" opacity="0.9" />
          <circle cx="0" cy="0" r="1.5" fill="var(--st-border)" opacity="0.9" />
        </g>

        <circle cx="40" cy="250" r="22" fill="var(--st-border)" opacity="0.8" />
        <g transform="translate(40, 250) scale(0.65)">
          <circle cx="0" cy="0" r="10.5" fill="none" stroke="white" strokeWidth="1.5" opacity="0.9" />
          <ellipse cx="0" cy="0" rx="4.5" ry="10.5" fill="none" stroke="white" strokeWidth="1" opacity="0.9" />
          <path d="M -10.5 0 L 10.5 0 M -7.5 -6 Q 0 -6 7.5 -6 M -7.5 6 Q 0 6 7.5 6" stroke="white" strokeWidth="1" fill="none" opacity="0.9" />
        </g>
      </g>

      <circle cx="250" cy="250" r="24" fill="white" opacity="0.9" />
      <g transform="translate(250, 247)">
        <path d="M 0 -11 C 4 -6 10 2 10 7 A 10 10 0 0 1 -10 7 C -10 2 -4 -6 0 -11 Z" fill="var(--st-background)" opacity="0.9" />
      </g>

      <circle r="3" fill="white" opacity="0.8">
        <animateMotion dur="3s" repeatCount="indefinite"><mpath href="#toCenter1" /></animateMotion>
        <animate attributeName="opacity" values="0.3;0.9;0" dur="3s" repeatCount="indefinite" />
      </circle>
      <circle r="3" fill="white" opacity="0.8">
        <animateMotion dur="3s" repeatCount="indefinite" begin="0.4s"><mpath href="#toCenter2" /></animateMotion>
        <animate attributeName="opacity" values="0.3;0.9;0" dur="3s" repeatCount="indefinite" begin="0.4s" />
      </circle>
      <circle r="3" fill="white" opacity="0.8">
        <animateMotion dur="3s" repeatCount="indefinite" begin="0.8s"><mpath href="#toCenter3" /></animateMotion>
        <animate attributeName="opacity" values="0.3;0.9;0" dur="3s" repeatCount="indefinite" begin="0.8s" />
      </circle>
      <circle r="3" fill="white" opacity="0.8">
        <animateMotion dur="3s" repeatCount="indefinite" begin="1.2s"><mpath href="#toCenter4" /></animateMotion>
        <animate attributeName="opacity" values="0.3;0.9;0" dur="3s" repeatCount="indefinite" begin="1.2s" />
      </circle>
      <circle r="3" fill="white" opacity="0.8">
        <animateMotion dur="3s" repeatCount="indefinite" begin="1.6s"><mpath href="#toCenter5" /></animateMotion>
        <animate attributeName="opacity" values="0.3;0.9;0" dur="3s" repeatCount="indefinite" begin="1.6s" />
      </circle>
      <circle r="3" fill="white" opacity="0.8">
        <animateMotion dur="3s" repeatCount="indefinite" begin="2s"><mpath href="#toCenter6" /></animateMotion>
        <animate attributeName="opacity" values="0.3;0.9;0" dur="3s" repeatCount="indefinite" begin="2s" />
      </circle>
      <circle r="3" fill="white" opacity="0.8">
        <animateMotion dur="3s" repeatCount="indefinite" begin="2.4s"><mpath href="#toCenter7" /></animateMotion>
        <animate attributeName="opacity" values="0.3;0.9;0" dur="3s" repeatCount="indefinite" begin="2.4s" />
      </circle>
      <circle r="3" fill="white" opacity="0.8">
        <animateMotion dur="3s" repeatCount="indefinite" begin="2.8s"><mpath href="#toCenter8" /></animateMotion>
        <animate attributeName="opacity" values="0.3;0.9;0" dur="3s" repeatCount="indefinite" begin="2.8s" />
      </circle>
    </svg>
  )
})
