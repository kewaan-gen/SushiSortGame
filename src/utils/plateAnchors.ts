/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SLOT_COORDS } from '../components/ConveyorBelt';

export interface PlayfieldPoint {
  x: number;
  y: number;
}

export function getElementCenterInPlayfield(
  playfieldEl: HTMLElement,
  targetEl: HTMLElement,
): PlayfieldPoint {
  const playRect = playfieldEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  return {
    x: targetRect.left + targetRect.width / 2 - playRect.left,
    y: targetRect.top + targetRect.height / 2 - playRect.top,
  };
}

export function getBeltSlotCenterInPlayfield(
  playfieldEl: HTMLElement,
  beltFrameEl: HTMLElement,
  slotIdx: number,
): PlayfieldPoint {
  const playRect = playfieldEl.getBoundingClientRect();
  const beltRect = beltFrameEl.getBoundingClientRect();
  const coord = SLOT_COORDS[slotIdx] ?? SLOT_COORDS[0];
  return {
    x: beltRect.left + (coord.x / 100) * beltRect.width - playRect.left,
    y: beltRect.top + (coord.y / 100) * beltRect.height - playRect.top,
  };
}
