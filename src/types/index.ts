/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type StudioToolId =
  | 'vinyl-video'
  | 'cd-video'
  | 'music-visualizer'
  | 'spotify-canvas'
  | 'vinyl-gif'
  | 'cd-gif'
  | 'glitch-maker'
  | 'press-kit'
  | 'bpm-to-ms'
  | 'bpm-key-finder'
  | 'musical-keys'
  | 'release-checklist';

export interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  bpm: number;
  key: string;
  genre: string;
  duration: number; // in seconds
  releaseDate: string;
  labelName: string;
  catalogNumber: string;
}

export type AspectRatio = '1:1' | '9:16' | '16:9' | '4:5';

export type VinylColor = 'black' | 'amber' | 'marble-red' | 'neon-cyan' | 'smoke-white' | 'gold';

export type BackgroundStyle = 'studio-dark' | 'wood-shelf' | 'ambient-glow' | 'neon-gradient' | 'minimal-grey' | 'transparent';

export interface VisualizerSettings {
  aspectRatio: AspectRatio;
  rotationSpeed: number; // RPM: 0, 33, 45, 78
  vinylColor: VinylColor;
  showSleeve: boolean;
  sleevePosition: number; // 0 to 1 (how far vinyl is pulled out)
  tonearmVisible: boolean;
  dustAndScratches: boolean;
  wobbleIntensity: number; // 0 to 1
  holographicIntensity: number; // for CD
  glitchIntensity: number; // for glitch maker
  visualizerType: 'bars' | 'circular' | 'wave' | 'particles' | 'none';
  backgroundStyle: BackgroundStyle;
  customBackgroundColor: string;
  particleColor: string;
  audioReactivePulse: boolean;
}

export type SubscriptionPlanId = 'free' | 'creator-pro' | 'label-studio';

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  tagline: string;
  features: string[];
  watermarkFree: boolean;
  maxResolution: '720p' | '1080p' | '4K';
  maxFps: 30 | 60;
  spotifyCanvasReady: boolean;
  commercialLicense: boolean;
}

export interface UserSubscription {
  planId: SubscriptionPlanId;
  status: 'active' | 'free_trial' | 'free';
  renewsOn?: string;
  couponCode?: string;
}

export interface EPKData {
  artistName: string;
  location: string;
  genres: string[];
  shortBio: string;
  fullBio: string;
  contactEmail: string;
  managementEmail: string;
  bookingAgent: string;
  demoTracks: { title: string; duration: string; streamUrl: string; tags: string }[];
  pressQuotes: { quote: string; publication: string; author: string }[];
  socialLinks: { spotify: string; instagram: string; soundcloud: string; youtube: string };
  highlights: string[];
}
