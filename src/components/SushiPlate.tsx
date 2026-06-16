/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SushiVariety } from '../types';
import { SUSHI_VARIETIES } from '../sushiConfig';

interface SushiPlateProps {
  variety: SushiVariety;
  count: number; // Retained for type compatibility
  size?: number; // width/height in px
  active?: boolean;
  className?: string;
  onClick?: () => void;
  // If provided, highlights the individual pieces up to this index as "eaten"
  eatenCount?: number;
  variant?: 'classic' | 'zen' | 'tweak';
}

export const SushiPlate: React.FC<SushiPlateProps> = ({
  variety,
  size = 64,
  active = true,
  className = '',
  onClick,
  eatenCount = 0,
  variant = 'classic',
}) => {
  const config = SUSHI_VARIETIES[variety];

  if (variant === 'tweak') {
    return (
      <div
        id={`plate-${variety}`}
        onClick={active ? onClick : undefined}
        className={`relative select-none flex items-center justify-center transition-all duration-300 ${
          active ? 'cursor-pointer hover:scale-107 active:scale-95' : ''
        } ${className}`}
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Saturated Solid Color Circle */}
          <circle cx="50" cy="50" r="42" fill={config.colorCode} stroke="#ffffff" strokeWidth="6" />
          <circle cx="50" cy="50" r="14" fill="#000000" opacity="0.3" />
          <circle cx="50" cy="50" r="6" fill="#ffffff" />
        </svg>
      </div>
    );
  }

  // A single beautifully detailed custom sushi piece drawing based on variety
  const renderRoundSushi = () => {
    const isEaten = eatenCount > 0;
    if (isEaten) {
      return (
        <g className="opacity-0 transition-opacity duration-300">
          <circle cx="50" cy="50" r="2" fill="#fff" />
        </g>
      );
    }

    const color = config.colorCode;

    switch (variety) {
      case 'maguro':
        // Tuna (Maguro): Sleek Oval Slice on Nigiri Rice Bed
        return (
          <g>
            {/* Nigiri rice base */}
            <rect x="34" y="44" width="32" height="15" rx="6" fill="#fafafa" stroke="#e2e8f0" strokeWidth="1.5" />
            {/* Sleek Ruby Tuna Oval Slice slanted */}
            <g transform="translate(50, 50) rotate(-12) translate(-50, -50)">
              <rect x="28" y="38" width="44" height="20" rx="9" fill="#ef4444" stroke="#dc2626" strokeWidth="1" />
              {/* White grain fat lines sheen */}
              <path d="M 36,41 Q 48,46 64,41" fill="none" stroke="#fee2e2" strokeWidth="2.2" opacity="0.8" />
              <path d="M 34,48 Q 48,53 62,48" fill="none" stroke="#fee2e2" strokeWidth="1.8" opacity="0.6" />
              <path d="M 36,54 Q 48,57 60,54" fill="none" stroke="#fee2e2" strokeWidth="1.2" opacity="0.4" />
            </g>
          </g>
        );

      case 'california':
        // California Roll: Tan Square plate. Textured Outer Rim.
        return (
          <g transform="translate(50, 50)">
            {/* Nori Wrap */}
            <circle cx="0" cy="0" r="25" fill="#1e293b" />
            {/* Rice Outer layer */}
            <circle cx="0" cy="0" r="23" fill="#f8fafc" />
            {/* Masago / Orange Toasted Sesame Seed outer rim dots */}
            <circle cx="0" cy="0" r="21" fill="none" stroke="#f97316" strokeWidth="2" strokeDasharray="3 3" />
            {/* Inner tiny Nori circular boundary */}
            <circle cx="0" cy="0" r="14" fill="#0f172a" />
            {/* Filling core: Avocado green and Crab pink */}
            <circle cx="-3" cy="-3" r="10" fill="#a3e635" />
            <circle cx="3" cy="3" r="9" fill="#fda4af" />
            <rect x="-3" y="-3" width="7" height="7" rx="1.5" fill="#fef08a" />
          </g>
        );

      case 'kappa':
        // Cucumber (Kappa): Dark Emerald / Crisp White Ring
        return (
          <g transform="translate(50, 50)">
            {/* Outer Dark Nori */}
            <circle cx="0" cy="0" r="24" fill="#0f172a" />
            {/* White Rice Layer */}
            <circle cx="0" cy="0" r="21" fill="#fbfcfc" />
            {/* Inner Nori Boundary */}
            <circle cx="0" cy="0" r="12" fill="#1e293b" />
            {/* Cucumber Star/Hex Core */}
            <path d="M0,-8 L7,-4 L7,4 L0,8 L-7,4 L-7,-4 Z" fill="#10b981" stroke="#047857" strokeWidth="1" />
            {/* Cucumber seeds */}
            <circle cx="-2" cy="-2" r="1.2" fill="#ecfdf5" />
            <circle cx="2" cy="1" r="1.2" fill="#ecfdf5" />
            <circle cx="0" cy="3" r="1.2" fill="#ecfdf5" />
          </g>
        );

      case 'tamago':
        // Egg (Tamago): Wood Triangle. Seaweed Staple.
        return (
          <g>
            {/* Nigiri rice base */}
            <rect x="34" y="46" width="32" height="14" rx="5" fill="#fafafa" stroke="#e2e8f0" strokeWidth="1.2" />
            {/* Solid Golden Yellow Rectangular Omelet */}
            <rect x="28" y="36" width="44" height="19" rx="4" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" />
            {/* Dark Seaweed Obi Strap (Staple) */}
            <rect x="44" y="34" width="12" height="28" rx="1" fill="#1e293b" />
          </g>
        );

      case 'ebi':
        // Shrimp (Ebi): Pointed Tail Fan on nigiri
        return (
          <g>
            {/* Nigiri rice base */}
            <rect x="33" y="45" width="32" height="14" rx="5" fill="#fafafa" stroke="#e2e8f0" strokeWidth="1.2" />
            
            {/* Shrimp Tail Fan pointing out on the right */}
            <path d="M 62,48 L 74,40 L 71,49 L 75,54 L 62,51 Z" fill="#ea580c" stroke="#c2410c" strokeWidth="1" />
            <line x1="65" y1="48" x2="72" y2="44" stroke="#fb923c" strokeWidth="1" />
            <line x1="65" y1="49" x2="72" y2="52" stroke="#fb923c" strokeWidth="1" />

            {/* Split Shrimp body */}
            <rect x="25" y="41" width="40" height="16" rx="6" fill="#f97316" stroke="#ea580c" strokeWidth="1" transform="rotate(-4 50 50)" />
            {/* White-pink shrimp striping ridges */}
            <path d="M 33,42 L 34,55 M 41,41 L 43,55 M 49,41 L 51,55 M 57,41 L 59,55" stroke="#fecdd3" strokeWidth="2.5" opacity="0.8" strokeLinecap="round" />
          </g>
        );

      case 'salmon':
        // Salmon (Sake): Coral Pink with white stripes
        return (
          <g>
            <rect x="34" y="44" width="32" height="15" rx="6" fill="#fafafa" stroke="#e2e8f0" strokeWidth="1.2" />
            <g transform="translate(50, 50) rotate(-8) translate(-50, -50)">
              <rect x="27" y="37" width="46" height="21" rx="8" fill="#f97316" stroke="#ea580c" strokeWidth="1.2" />
              {/* Signature diagonal marble strips */}
              <line x1="33" y1="38" x2="43" y2="57" stroke="#ffffff" strokeWidth="2.2" opacity="0.9" strokeLinecap="round" />
              <line x1="43" y1="38" x2="53" y2="57" stroke="#ffffff" strokeWidth="2.2" opacity="0.9" strokeLinecap="round" />
              <line x1="53" y1="38" x2="63" y2="57" stroke="#ffffff" strokeWidth="2.2" opacity="0.9" strokeLinecap="round" />
            </g>
          </g>
        );

      case 'unagi':
        // Unagi: Dark glazed eel slice with white sesame dots & sweet drizzle zigzag
        return (
          <g>
            <rect x="34" y="44" width="32" height="15" rx="6" fill="#fafafa" stroke="#e2e8f0" strokeWidth="1.2" />
            <g transform="translate(50, 50) rotate(-14) translate(-50, -50)">
              {/* Dark eel slice */}
              <rect x="26" y="36" width="48" height="22" rx="6" fill="#451a03" stroke="#270e00" strokeWidth="1.5" />
              {/* Sweet glaze zigzag strip */}
              <path d="M 28,47 L 34,42 L 42,50 L 50,42 L 58,50 L 66,43" fill="none" stroke="#f59e0b" strokeWidth="1.8" />
              {/* White sesame dots */}
              <circle cx="32" cy="46" r="1.2" fill="#fff" />
              <circle cx="48" cy="47" r="1.2" fill="#fff" />
              <circle cx="60" cy="45" r="1.2" fill="#fff" />
              <circle cx="40" cy="42" r="1" fill="#fff" />
              <circle cx="54" cy="43" r="1" fill="#fff" />
            </g>
          </g>
        );

      case 'ikura':
        // Salmon Roe (Ikura): Battleship Gunkan Maki wrapped in tall Nori with orange shiny spheres piled inside
        return (
          <g transform="translate(50, 50)">
            {/* Outer tall Gunkan Maki Nori wrap */}
            <ellipse cx="0" cy="5" rx="22" ry="17" fill="#09090b" stroke="#18181b" strokeWidth="1.5" />
            {/* Red caviar / Ikura translucent beads stacked */}
            <circle cx="-10" cy="0" r="6" fill="#ef4444" stroke="#b91c1c" strokeWidth="0.5" />
            <circle cx="-10" cy="0" r="2" fill="#fff" opacity="0.6" /> {/* caviar highlight */}
            
            <circle cx="-2" cy="3" r="6.5" fill="#f97316" stroke="#c2410c" strokeWidth="0.5" />
            <circle cx="-2" cy="3" r="2.2" fill="#fff" opacity="0.6" />

            <circle cx="8" cy="1" r="5.5" fill="#ef4444" stroke="#b91c1c" strokeWidth="0.5" />
            <circle cx="8" cy="1" r="1.8" fill="#fff" opacity="0.6" />

            <circle cx="-6" cy="-6" r="6" fill="#f97316" stroke="#c2410c" strokeWidth="0.5" />
            <circle cx="-6" cy="-6" r="2" fill="#fff" opacity="0.6" />

            <circle cx="4" cy="-5" r="6.5" fill="#ef4444" stroke="#b91c1c" strokeWidth="0.5" />
            <circle cx="4" cy="-5" r="2.2" fill="#fff" opacity="0.6" />
            
            <circle cx="1" cy="-1" r="5.5" fill="#ea580c" stroke="#9a3412" strokeWidth="0.5" />
            <circle cx="1" cy="-1" r="1.8" fill="#fff" opacity="0.6" />
          </g>
        );

      case 'saba':
      default:
        // Saba: Slate silver fish skin slice with vertical cut hashes
        return (
          <g>
            <rect x="34" y="44" width="32" height="15" rx="6" fill="#fafafa" stroke="#e2e8f0" strokeWidth="1.2" />
            <g transform="translate(50, 50) rotate(-6) translate(-50, -50)">
              {/* Fish body */}
              <rect x="27" y="38" width="46" height="20" rx="8" fill="#475569" stroke="#334155" strokeWidth="1.2" />
              {/* Silver central stripe */}
              <path d="M 28,48 C 38,47 54,47 71,48" fill="none" stroke="#cbd5e1" strokeWidth="2.5" />
              {/* Diagonal texture cut slices */}
              <line x1="36" y1="40" x2="39" y2="56" stroke="#1e293b" strokeWidth="1" strokeLinecap="round" />
              <line x1="44" y1="40" x2="47" y2="56" stroke="#1e293b" strokeWidth="1" strokeLinecap="round" />
              <line x1="52" y1="40" x2="55" y2="56" stroke="#1e293b" strokeWidth="1" strokeLinecap="round" />
              <line x1="60" y1="40" x2="63" y2="56" stroke="#1e293b" strokeWidth="1" strokeLinecap="round" />
            </g>
          </g>
        );
    }
  };

  const renderPlateBackground = () => {
    switch (config.plateSilhouette) {
      case 'square':
        // California Roll: Tan Square plate. Textured Outer Rim.
        return (
          <g>
            <rect x="6" y="6" width="88" height="88" rx="14" fill="#eed9b3" stroke="#b58d53" strokeWidth="3" />
            <rect x="14" y="14" width="72" height="72" rx="8" fill="none" stroke="#d5ac6d" strokeWidth="2.5" strokeDasharray="4 4" />
          </g>
        );
      case 'dark-circle':
        // Cucumber (Kappa): Dark Emerald plate. Crisp White Ring.
        return (
          <g>
            <circle cx="50" cy="50" r="46" fill="#044e3b" stroke="#022c22" strokeWidth="3" />
            <circle cx="50" cy="50" r="38" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.85" />
            <circle cx="50" cy="50" r="32" fill="none" stroke="#022c22" strokeWidth="1" opacity="0.5" />
          </g>
        );
      case 'triangle':
        // Egg (Tamago): Wood Triangle plate. Seaweed Staple.
        return (
          <g>
            {/* Equilateral triangle pointing upwards or stylized rounded triangle */}
            <path d="M 50,6 L 94,82 A 4,4 0 0,1 90,86 L 10,86 A 4,4 0 0,1 6,82 Z" fill="#cfab7a" stroke="#8c5b36" strokeWidth="3" strokeLinejoin="round" />
            <path d="M 50,16 L 82,74 A 2,2 0 0,1 80,76 L 20,76 A 2,2 0 0,1 18,74 Z" fill="none" stroke="#b28453" strokeWidth="1.5" strokeDasharray="3 3" />
          </g>
        );
      case 'blue-circle':
        // Shrimp (Ebi): Ocean Blue Circle. Pointed Tail Fan.
        return (
          <g>
            <circle cx="50" cy="50" r="46" fill="#1d3557" stroke="#0f1a2c" strokeWidth="3" />
            <circle cx="50" cy="50" r="39" fill="none" stroke="#a8dadc" strokeWidth="2.5" opacity="0.6" />
            <circle cx="50" cy="50" r="32" fill="none" stroke="#a4c2cb" strokeWidth="1" opacity="0.4" />
          </g>
        );
      case 'circle':
      default:
        // Tuna (Maguro): Cream Circle plate. Sleek Oval Slice.
        return (
          <g>
            <circle cx="50" cy="50" r="46" fill="#fffdf5" stroke="#dacbb0" strokeWidth="3" />
            <circle cx="50" cy="50" r="38" fill="none" stroke="#ebdcb9" strokeWidth="2" />
            <circle cx="50" cy="50" r="32" fill="none" stroke="#cbd5e1" strokeWidth="1.2" opacity="0.45" />
          </g>
        );
    }
  };

  return (
    <div
      id={`plate-${variety}`}
      onClick={active ? onClick : undefined}
      className={`relative select-none flex items-center justify-center transition-all duration-300 ${
        active ? 'cursor-pointer hover:scale-107 active:scale-95' : ''
      } ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full drop-shadow-md overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Shadow layer for realistic depth */}
        <ellipse cx="50" cy="53" rx="44" ry="43" fill="#000" opacity="0.12" className="blur-[1px]" />

        {/* Plate Background */}
        {renderPlateBackground()}

        {/* Inner Glaze circle on plate */}
        <circle cx="50" cy="50" r="34" fill="none" stroke="#fff" strokeWidth="0.75" opacity="0.1" />

        {/* Render the single round sushi */}
        {renderRoundSushi()}
      </svg>
    </div>
  );
};
