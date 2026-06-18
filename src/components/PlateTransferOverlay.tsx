/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { SushiPlate } from './SushiPlate';
import { SushiVariety } from '../types';

export interface PlateTransferFlight {
  key: string;
  variety: SushiVariety;
  count: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  size: number;
  variant: 'classic' | 'zen' | 'tweak';
}

interface PlateTransferOverlayProps {
  transfers: PlateTransferFlight[];
  onComplete: (key: string) => void;
}

export const PlateTransferOverlay: React.FC<PlateTransferOverlayProps> = ({
  transfers,
  onComplete,
}) => (
  <div className="absolute inset-0 overflow-visible pointer-events-none z-[80]">
    {transfers.map((flight) => {
      const jumpLift = Math.min(72, Math.max(36, Math.abs(flight.from.y - flight.to.y) * 0.35 + 28));
      const midY = Math.min(flight.from.y, flight.to.y) - jumpLift;

      return (
        <motion.div
          key={flight.key}
          className="absolute"
          style={{
            width: flight.size,
            height: flight.size,
            marginLeft: -flight.size / 2,
            marginTop: -flight.size / 2,
            filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.28))',
          }}
          initial={{
            left: flight.from.x,
            top: flight.from.y,
            scale: 0.82,
            rotate: 0,
            opacity: 0.95,
          }}
          animate={{
            left: flight.to.x,
            top: [flight.from.y, midY, flight.to.y],
            scale: [0.82, 1.18, 1],
            rotate: [0, flight.from.y > flight.to.y ? -10 : 10, 0],
            opacity: 1,
          }}
          transition={{
            duration: 0.52,
            ease: [0.22, 1, 0.36, 1],
            times: [0, 0.45, 1],
          }}
          onAnimationComplete={() => onComplete(flight.key)}
        >
          <SushiPlate
            variety={flight.variety}
            count={flight.count}
            size={flight.size}
            active={false}
            variant={flight.variant}
          />
        </motion.div>
      );
    })}
  </div>
);
