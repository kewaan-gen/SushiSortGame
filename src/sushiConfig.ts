/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SushiVariety, SushiVarietyConfig } from './types';

export const SUSHI_VARIETIES: Record<SushiVariety, SushiVarietyConfig> = {
  maguro: {
    id: 'maguro',
    name: 'Red Sushi',
    displayName: 'Red',
    colorCode: '#ef4444', // Red
    plateSilhouette: 'circle',
    plateColor: '#fafaf9',
    visualAnchor: 'Red color roll',
  },
  california: {
    id: 'california',
    name: 'Purple Sushi',
    displayName: 'Purple',
    colorCode: '#a855f7', // Purple
    plateSilhouette: 'circle',
    plateColor: '#fafaf9',
    visualAnchor: 'Purple color roll',
  },
  kappa: {
    id: 'kappa',
    name: 'Green Sushi',
    displayName: 'Green',
    colorCode: '#10b981', // Green
    plateSilhouette: 'circle',
    plateColor: '#fafaf9',
    visualAnchor: 'Green color roll',
  },
  tamago: {
    id: 'tamago',
    name: 'Yellow Sushi',
    displayName: 'Yellow',
    colorCode: '#eab308', // Yellow
    plateSilhouette: 'circle',
    plateColor: '#fafaf9',
    visualAnchor: 'Yellow color roll',
  },
  ebi: {
    id: 'ebi',
    name: 'Blue Sushi',
    displayName: 'Blue',
    colorCode: '#3b82f6', // Blue
    plateSilhouette: 'circle',
    plateColor: '#fafaf9',
    visualAnchor: 'Blue color roll',
  },
  salmon: {
    id: 'salmon',
    name: 'Orange Sushi',
    displayName: 'Orange',
    colorCode: '#f97316', // Orange
    plateSilhouette: 'circle',
    plateColor: '#fafaf9',
    visualAnchor: 'Orange color roll',
  },
  unagi: {
    id: 'unagi',
    name: 'Pink Sushi',
    displayName: 'Pink',
    colorCode: '#ec4899', // Pink
    plateSilhouette: 'circle',
    plateColor: '#fafaf9',
    visualAnchor: 'Pink color roll',
  },
  ikura: {
    id: 'ikura',
    name: 'Teal Sushi',
    displayName: 'Teal',
    colorCode: '#14b8a6', // Teal
    plateSilhouette: 'circle',
    plateColor: '#fafaf9',
    visualAnchor: 'Teal color roll',
  },
  saba: {
    id: 'saba',
    name: 'Slate Sushi',
    displayName: 'Slate',
    colorCode: '#64748b', // Slate
    plateSilhouette: 'circle',
    plateColor: '#fafaf9',
    visualAnchor: 'Slate color roll',
  },
};

export const CHARACTER_EMOJIS = [
  { emoji: '🐱', name: 'Neko-san' },
  { emoji: '🦊', name: 'Kitsune-sama' },
  { emoji: '🐻', name: 'Kuma-chan' },
  { emoji: '🐼', name: 'Panda-dono' },
  { emoji: '🐰', name: 'Usagi-chan' },
  { emoji: '🦁', name: 'Leo-sensei' },
  { emoji: '🐵', name: 'Saru-kun' },
  { emoji: '🐸', name: 'Kaeru-sama' },
];
