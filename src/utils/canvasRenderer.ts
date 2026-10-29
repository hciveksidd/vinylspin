/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StudioToolId, TrackMetadata, VisualizerSettings, VinylColor, BackgroundStyle } from '../types';

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  toolId: StudioToolId;
  metadata: TrackMetadata;
  settings: VisualizerSettings;
  coverImage: HTMLImageElement | null;
  rotationAngle: number; // in radians
  time: number; // elapsed seconds
  frequencyData: Uint8Array;
  waveformData: Uint8Array;
  bassEnergy: number; // 0 to 1
  isWatermarked: boolean;
  customWatermarkText?: string;
}

export function renderFrame(rc: RenderContext) {
  const { canvas, ctx, toolId, metadata, settings, coverImage, rotationAngle, time, frequencyData, bassEnergy, isWatermarked } = rc;
  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // 1. Draw Background
  drawBackground(ctx, width, height, settings.backgroundStyle, coverImage, settings.customBackgroundColor);

  // 2. Draw Audio Reactive Ambient Glow (behind record)
  if (settings.audioReactivePulse) {
    const glowRadius = Math.min(width, height) * (0.35 + bassEnergy * 0.12);
    const glow = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, glowRadius);
    glow.addColorStop(0, `rgba(245, 158, 11, ${0.15 + bassEnergy * 0.25})`);
    glow.addColorStop(0.5, `rgba(217, 119, 6, ${0.08 + bassEnergy * 0.12})`);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  // 3. Draw Audio Reactive Particles
  if (settings.visualizerType === 'particles') {
    drawParticles(ctx, width, height, time, bassEnergy, settings.particleColor);
  }

  // 4. Draw Specific Tool Object
  if (toolId === 'vinyl-video' || toolId === 'vinyl-gif' || toolId === 'spotify-canvas') {
    drawVinylScene(rc);
  } else if (toolId === 'cd-video' || toolId === 'cd-gif') {
    drawCDScene(rc);
  } else if (toolId === 'glitch-maker') {
    drawGlitchScene(rc);
  } else {
    // Default visualizer mode
    drawVisualizerScene(rc);
  }

  // 5. Draw Foreground Audio Visualizer (e.g. Spectrum Bars or Wave)
  if (settings.visualizerType === 'bars') {
    drawSpectrumBars(ctx, width, height, frequencyData, settings.particleColor);
  } else if (settings.visualizerType === 'wave') {
    drawOscilloscopeWave(ctx, width, height, rc.waveformData, settings.particleColor);
  } else if (settings.visualizerType === 'circular') {
    drawCircularSpectrum(ctx, width / 2, height / 2, Math.min(width, height) * 0.42, frequencyData, settings.particleColor);
  }

  // 6. Draw Watermark if applicable
  if (isWatermarked) {
    drawWatermark(ctx, width, height, rc.customWatermarkText);
  }
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: BackgroundStyle,
  coverImage: HTMLImageElement | null,
  customColor: string
) {
  if (style === 'transparent') {
    ctx.clearRect(0, 0, width, height);
    return;
  }

  if (style === 'ambient-glow' && coverImage) {
    // Draw blurred cover image as dreamy background
    ctx.save();
    ctx.filter = 'blur(40px) brightness(0.4)';
    ctx.drawImage(coverImage, -width * 0.2, -height * 0.2, width * 1.4, height * 1.4);
    ctx.restore();

    // Dark vignette overlay
    const vig = ctx.createRadialGradient(width / 2, height / 2, width * 0.2, width / 2, height / 2, width * 0.8);
    vig.addColorStop(0, 'rgba(15, 17, 23, 0.4)');
    vig.addColorStop(1, 'rgba(11, 13, 17, 0.9)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (style === 'wood-shelf') {
    // Elegant warm wooden studio shelf background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#1c1613');
    grad.addColorStop(0.7, '#2b1e17');
    grad.addColorStop(1, '#150f0c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle wood grain lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    return;
  }

  if (style === 'neon-gradient') {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#0a0d17');
    grad.addColorStop(0.5, '#171026');
    grad.addColorStop(1, '#0d1824');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (style === 'minimal-grey') {
    ctx.fillStyle = '#1c1e24';
    ctx.fillRect(0, 0, width, height);
    return;
  }

  // Default: studio-dark
  const grad = ctx.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, Math.max(width, height) * 0.7);
  grad.addColorStop(0, '#181b22');
  grad.addColorStop(0.7, '#0f1115');
  grad.addColorStop(1, '#090a0d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function drawVinylScene(rc: RenderContext) {
  const { ctx, canvas, settings, coverImage, rotationAngle, metadata } = rc;
  const width = canvas.width;
  const height = canvas.height;
  const isVertical = settings.aspectRatio === '9:16';

  const recordRadius = Math.min(width, height) * (isVertical ? 0.38 : 0.35);

  let vinylCenterX = width / 2;
  let vinylCenterY = height / 2;
  let sleeveX = width / 2 - recordRadius * 1.05;
  let sleeveY = height / 2 - recordRadius * 0.95;
  const sleeveSize = recordRadius * 1.95;

  if (settings.showSleeve) {
    if (isVertical) {
      // In 9:16 vertical mobile layout, place sleeve centered and vinyl popping above/below
      sleeveX = width / 2 - sleeveSize / 2;
      sleeveY = height * 0.52 - sleeveSize / 2;
      vinylCenterX = width / 2;
      vinylCenterY = sleeveY + sleeveSize * 0.35 - (settings.sleevePosition * recordRadius * 0.8);
    } else {
      // Horizontal layout: sleeve on left, vinyl pulled out to the right
      const shift = settings.sleevePosition * (recordRadius * 0.75);
      vinylCenterX = width / 2 + shift;
      vinylCenterY = height / 2;
      sleeveX = width / 2 - sleeveSize * 0.65 - (shift * 0.2);
      sleeveY = height / 2 - sleeveSize / 2;
    }

    // 1. Draw Album Sleeve / Jacket
    drawAlbumSleeve(ctx, sleeveX, sleeveY, sleeveSize, coverImage, metadata);
  }

  // 2. Draw Vinyl Disc
  drawVinylDisc(ctx, vinylCenterX, vinylCenterY, recordRadius, rotationAngle, settings.vinylColor, coverImage, metadata, settings.wobbleIntensity);

  // 3. Draw Tonearm if enabled
  if (settings.tonearmVisible) {
    drawTonearm(ctx, vinylCenterX, vinylCenterY, recordRadius);
  }
}

function drawAlbumSleeve(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  coverImage: HTMLImageElement | null,
  metadata: TrackMetadata
) {
  ctx.save();

  // Sleeve Drop Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetX = -5;
  ctx.shadowOffsetY = 15;

  // Sleeve Background
  ctx.fillStyle = '#14161c';
  ctx.fillRect(x, y, size, size);

  // Reset shadow for inner drawing
  ctx.shadowColor = 'transparent';

  // Draw Cover Artwork if loaded
  if (coverImage) {
    ctx.drawImage(coverImage, x, y, size, size);
  } else {
    // Elegant procedural album art placeholder
    const grad = ctx.createLinearGradient(x, y, x + size, y + size);
    grad.addColorStop(0, '#2e1065');
    grad.addColorStop(0.5, '#4c1d95');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, size, size);

    // Decorative geometric artwork
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 20, y + 20, size - 40, size - 40);

    ctx.fillStyle = 'rgba(245, 158, 11, 0.8)';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.max(14, size * 0.05)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(metadata.title, x + size / 2, y + size * 0.75);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = `500 ${Math.max(11, size * 0.035)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText(metadata.artist, x + size / 2, y + size * 0.82);
  }

  // Cardboard sleeve sheen and worn spine edge
  const edge = ctx.createLinearGradient(x, y, x + 15, y);
  edge.addColorStop(0, 'rgba(0,0,0,0.5)');
  edge.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  edge.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = edge;
  ctx.fillRect(x, y, 15, size);

  // Right sleeve opening shadow
  const openShadow = ctx.createLinearGradient(x + size - 10, y, x + size, y);
  openShadow.addColorStop(0, 'rgba(0,0,0,0)');
  openShadow.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = openShadow;
  ctx.fillRect(x + size - 10, y, 10, size);

  ctx.restore();
}

function drawVinylDisc(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  rotation: number,
  colorScheme: VinylColor,
  coverImage: HTMLImageElement | null,
  metadata: TrackMetadata,
  wobbleIntensity: number
) {
  ctx.save();

  // Subtle analog wobble
  const wobbleX = Math.sin(rotation * 2) * (wobbleIntensity * 2);
  const wobbleY = Math.cos(rotation * 2) * (wobbleIntensity * 2);
  const cx = centerX + wobbleX;
  const cy = centerY + wobbleY;

  // Drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetX = 8;
  ctx.shadowOffsetY = 16;

  // 1. Vinyl Base Color
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  let baseFill: string | CanvasGradient = '#101114';

  if (colorScheme === 'amber') {
    const amb = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
    amb.addColorStop(0, '#f59e0b');
    amb.addColorStop(0.7, '#b45309');
    amb.addColorStop(1, '#451a03');
    baseFill = amb;
  } else if (colorScheme === 'marble-red') {
    const red = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius);
    red.addColorStop(0, '#ef4444');
    red.addColorStop(0.6, '#991b1b');
    red.addColorStop(1, '#450a0a');
    baseFill = red;
  } else if (colorScheme === 'neon-cyan') {
    const cyan = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
    cyan.addColorStop(0, '#06b6d4');
    cyan.addColorStop(0.8, '#0e7490');
    cyan.addColorStop(1, '#083344');
    baseFill = cyan;
  } else if (colorScheme === 'gold') {
    const gold = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius);
    gold.addColorStop(0, '#fbbf24');
    gold.addColorStop(0.7, '#d97706');
    gold.addColorStop(1, '#78350f');
    baseFill = gold;
  } else if (colorScheme === 'smoke-white') {
    const smoke = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
    smoke.addColorStop(0, '#f1f5f9');
    smoke.addColorStop(0.8, '#cbd5e1');
    smoke.addColorStop(1, '#64748b');
    baseFill = smoke;
  }

  ctx.fillStyle = baseFill;
  ctx.fill();

  // Reset shadow
  ctx.shadowColor = 'transparent';

  // 2. Vinyl Grooves (dense concentric rings)
  ctx.strokeStyle = colorScheme === 'smoke-white' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  const innerGroove = radius * 0.36;
  const outerGroove = radius * 0.94;
  for (let r = innerGroove; r < outerGroove; r += 2.5) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Run-out groove band (smooth shiny zone between music and label)
  ctx.fillStyle = colorScheme === 'smoke-white' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.03)';
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.38, 0, Math.PI * 2);
  ctx.arc(cx, cy, radius * 0.34, 0, Math.PI * 2, true);
  ctx.fill();

  // 3. Realistic Radial Specular Lighting / Sheen (Hourglass light reflection)
  // Two specular cones rotating slightly with the angle
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation * 0.1); // specular light shifts slowly with viewer/rotation

  const drawSpecularCone = (startAngle: number, endAngle: number) => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius * 0.96, startAngle, endAngle);
    ctx.closePath();
    const coneGrad = ctx.createRadialGradient(0, 0, radius * 0.35, 0, 0, radius);
    coneGrad.addColorStop(0, 'rgba(255, 255, 255, 0.02)');
    coneGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.12)');
    coneGrad.addColorStop(1, 'rgba(255, 255, 255, 0.01)');
    ctx.fillStyle = coneGrad;
    ctx.fill();
  };

  // Top-left and bottom-right reflections
  drawSpecularCone(-Math.PI * 0.28, -Math.PI * 0.06);
  drawSpecularCone(Math.PI * 0.72, Math.PI * 0.94);
  // Perpendicular subtle secondary highlights
  drawSpecularCone(Math.PI * 0.22, Math.PI * 0.44);
  drawSpecularCone(-Math.PI * 0.78, -Math.PI * 0.56);
  ctx.restore();

  // 4. Center Label (rotates with record)
  const labelRadius = radius * 0.34;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  // Label Base
  ctx.beginPath();
  ctx.arc(0, 0, labelRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();

  // Clip label area
  ctx.save();
  ctx.clip();

  if (coverImage) {
    ctx.drawImage(coverImage, -labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
    // Darken inner ring slightly for typography readability
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(-labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
  } else {
    // Stylized label
    const labelGrad = ctx.createLinearGradient(-labelRadius, -labelRadius, labelRadius, labelRadius);
    labelGrad.addColorStop(0, '#f59e0b');
    labelGrad.addColorStop(1, '#b45309');
    ctx.fillStyle = labelGrad;
    ctx.fillRect(-labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
  }

  // Label Ring Border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, labelRadius - 4, 0, Math.PI * 2);
  ctx.stroke();

  // Circular text: Track & Artist
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.max(8, labelRadius * 0.18)}px 'Plus Jakarta Sans', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(metadata.title.slice(0, 20), 0, -labelRadius * 0.38);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = `600 ${Math.max(7, labelRadius * 0.13)}px 'Plus Jakarta Sans', sans-serif`;
  ctx.fillText(metadata.artist.slice(0, 24), 0, -labelRadius * 0.2);

  // Label catalog metadata
  ctx.font = `500 ${Math.max(6, labelRadius * 0.1)}px 'JetBrains Mono', monospace`;
  ctx.fillText('33⅓ RPM • STEREO', 0, labelRadius * 0.35);
  ctx.fillText(metadata.catalogNumber || 'SV-2026-X', 0, labelRadius * 0.5);

  ctx.restore(); // unclip label

  // 5. Center Spindle Hole (metallic silver grommet)
  const spindleRadius = radius * 0.038;
  ctx.beginPath();
  ctx.arc(0, 0, spindleRadius + 2, 0, Math.PI * 2);
  ctx.fillStyle = '#cbd5e1';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, spindleRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#090a0d';
  ctx.fill();

  ctx.restore(); // un-rotate
  ctx.restore(); // un-translate
}

function drawTonearm(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number) {
  ctx.save();
  const pivotX = centerX + radius * 1.18;
  const pivotY = centerY - radius * 0.85;

  // Tonearm base pivot
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, radius * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = '#334155';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(pivotX, pivotY, radius * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = '#64748b';
  ctx.fill();

  // Tonearm metal rod
  const needleX = centerX + radius * 0.58;
  const needleY = centerY + radius * 0.25;

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(needleX + 30, needleY - 20);
  ctx.lineTo(needleX, needleY);
  ctx.stroke();

  // Cartridge Head
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(needleX - 6, needleY - 4, 18, 8);

  ctx.restore();
}

function drawCDScene(rc: RenderContext) {
  const { ctx, canvas, settings, coverImage, rotationAngle, metadata } = rc;
  const width = canvas.width;
  const height = canvas.height;
  const isVertical = settings.aspectRatio === '9:16';
  const cdRadius = Math.min(width, height) * (isVertical ? 0.38 : 0.36);

  const cx = width / 2;
  const cy = height / 2;

  ctx.save();
  // Drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 35;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 12;

  // 1. CD Outer Rim & Base
  ctx.beginPath();
  ctx.arc(cx, cy, cdRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#e2e8f0';
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // 2. CD Mirrored / Iridescent Layer
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotationAngle);

  // If cover art exists, print it on top half or circular print
  if (coverImage) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, cdRadius * 0.98, 0, Math.PI * 2);
    ctx.arc(0, 0, cdRadius * 0.36, 0, Math.PI * 2, true);
    ctx.clip();

    ctx.globalAlpha = 0.85;
    ctx.drawImage(coverImage, -cdRadius, -cdRadius, cdRadius * 2, cdRadius * 2);
    ctx.restore();
  }

  // Holographic rainbow dispersion
  const holoInt = settings.holographicIntensity ?? 0.8;
  const holo = ctx.createConicGradient(rotationAngle * 2, 0, 0);
  holo.addColorStop(0, `rgba(239, 68, 68, ${0.15 * holoInt})`);
  holo.addColorStop(0.16, `rgba(245, 158, 11, ${0.25 * holoInt})`);
  holo.addColorStop(0.33, `rgba(16, 185, 129, ${0.28 * holoInt})`);
  holo.addColorStop(0.5, `rgba(6, 182, 212, ${0.3 * holoInt})`);
  holo.addColorStop(0.66, `rgba(99, 102, 241, ${0.28 * holoInt})`);
  holo.addColorStop(0.83, `rgba(217, 70, 239, ${0.25 * holoInt})`);
  holo.addColorStop(1, `rgba(239, 68, 68, ${0.15 * holoInt})`);

  ctx.beginPath();
  ctx.arc(0, 0, cdRadius * 0.98, 0, Math.PI * 2);
  ctx.arc(0, 0, cdRadius * 0.36, 0, Math.PI * 2, true);
  ctx.fillStyle = holo;
  ctx.fill();

  // Fine data spiral lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let r = cdRadius * 0.38; r < cdRadius * 0.96; r += 8) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 3. Clear Plastic Inner Hub
  ctx.beginPath();
  ctx.arc(0, 0, cdRadius * 0.36, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
  ctx.fill();

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Spindle hole
  ctx.beginPath();
  ctx.arc(0, 0, cdRadius * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = '#0f1117';
  ctx.fill();

  // Label stamp
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 ${Math.max(9, cdRadius * 0.08)}px 'Plus Jakarta Sans', sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(metadata.title, 0, -cdRadius * 0.65);
  ctx.font = `500 ${Math.max(7, cdRadius * 0.05)}px 'Plus Jakarta Sans', sans-serif`;
  ctx.fillText(`COMPACT DISC DIGITAL AUDIO • ${metadata.artist}`, 0, -cdRadius * 0.55);

  ctx.restore(); // unrotate
  ctx.restore();
}

function drawGlitchScene(rc: RenderContext) {
  const { ctx, canvas, coverImage, metadata, settings, time, bassEnergy } = rc;
  const width = canvas.width;
  const height = canvas.height;
  const size = Math.min(width, height) * 0.72;
  const x = (width - size) / 2;
  const y = (height - size) / 2;

  ctx.save();

  // Bass reactive jitter
  const jitter = (Math.random() - 0.5) * (settings.glitchIntensity * 12 + bassEnergy * 8);

  // RGB Split Effect
  if (coverImage) {
    // Red Channel
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(coverImage, x - 6 + jitter, y, size, size);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
    ctx.fillRect(x, y, size, size);
    ctx.restore();

    // Cyan / Blue Channel
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(coverImage, x + 6 - jitter, y, size, size);
    ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
    ctx.fillRect(x, y, size, size);
    ctx.restore();

    // Normal pass
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.drawImage(coverImage, x, y, size, size);
    ctx.restore();
  }

  // Scanlines
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  for (let scanY = y; scanY < y + size; scanY += 4) {
    ctx.fillRect(x, scanY, size, 1.5);
  }

  // Random horizontal glitch slices
  if (Math.random() < 0.4) {
    const sliceY = y + Math.random() * size;
    const sliceH = Math.random() * 20 + 5;
    const sliceShift = (Math.random() - 0.5) * 35;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(x + sliceShift, sliceY, size, sliceH);
  }

  // Retro VHS HUD overlay
  ctx.fillStyle = '#22c55e';
  ctx.font = "700 13px 'JetBrains Mono', monospace";
  ctx.fillText('PLAY ▶ 00:' + String(Math.floor(time)).padStart(2, '0') + ':18', x + 16, y + 26);
  ctx.fillText('SP 120min', x + size - 90, y + 26);
  ctx.fillText(metadata.title.toUpperCase(), x + 16, y + size - 16);

  ctx.restore();
}

function drawVisualizerScene(rc: RenderContext) {
  const { ctx, canvas, coverImage, metadata, bassEnergy } = rc;
  const width = canvas.width;
  const height = canvas.height;
  const size = Math.min(width, height) * 0.45;
  const cx = width / 2;
  const cy = height / 2;

  ctx.save();

  // Floating Cover Art with bass pulsation
  const scale = 1 + bassEnergy * 0.06;
  const drawSize = size * scale;

  ctx.shadowColor = 'rgba(245, 158, 11, 0.4)';
  ctx.shadowBlur = 40 + bassEnergy * 30;

  if (coverImage) {
    ctx.drawImage(coverImage, cx - drawSize / 2, cy - drawSize / 2, drawSize, drawSize);
  } else {
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(cx - drawSize / 2, cy - drawSize / 2, drawSize, drawSize);
  }

  ctx.shadowColor = 'transparent';

  // Track info
  ctx.fillStyle = '#ffffff';
  ctx.font = "700 18px 'Plus Jakarta Sans', sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText(metadata.title, cx, cy + drawSize / 2 + 36);

  ctx.fillStyle = '#94a3b8';
  ctx.font = "500 14px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText(metadata.artist, cx, cy + drawSize / 2 + 58);

  ctx.restore();
}

function drawSpectrumBars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  freqData: Uint8Array,
  color: string
) {
  const barCount = 48;
  const totalWidth = width * 0.85;
  const startX = (width - totalWidth) / 2;
  const barWidth = (totalWidth / barCount) - 3;
  const maxHeight = height * 0.22;
  const baseY = height * 0.92;

  ctx.save();
  for (let i = 0; i < barCount; i++) {
    const dataIdx = Math.floor((i / barCount) * (freqData.length * 0.75));
    const val = (freqData[dataIdx] || 10) / 255;
    const barH = Math.max(4, val * maxHeight);
    const x = startX + i * (barWidth + 3);

    const grad = ctx.createLinearGradient(x, baseY - barH, x, baseY);
    grad.addColorStop(0, color || '#f59e0b');
    grad.addColorStop(1, 'rgba(245, 158, 11, 0.2)');

    ctx.fillStyle = grad;
    ctx.fillRect(x, baseY - barH, barWidth, barH);

    // Peak dot
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, baseY - barH - 2, barWidth, 2);
  }
  ctx.restore();
}

function drawOscilloscopeWave(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  waveData: Uint8Array,
  color: string
) {
  const baseY = height * 0.88;
  const sliceWidth = width / waveData.length;

  ctx.save();
  ctx.strokeStyle = color || '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = color || '#f59e0b';
  ctx.shadowBlur = 10;

  ctx.beginPath();
  for (let i = 0; i < waveData.length; i++) {
    const v = waveData[i] / 128.0; // 0 to 2
    const y = baseY + (v - 1.0) * 45;
    const x = i * sliceWidth;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function drawCircularSpectrum(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  freqData: Uint8Array,
  color: string
) {
  const count = 72;
  ctx.save();
  ctx.strokeStyle = color || '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dataIdx = Math.floor((i / count) * (freqData.length * 0.7));
    const val = (freqData[dataIdx] || 5) / 255;
    const barLen = 6 + val * 45;

    const x1 = cx + Math.cos(angle) * radius;
    const y1 = cy + Math.sin(angle) * radius;
    const x2 = cx + Math.cos(angle) * (radius + barLen);
    const y2 = cy + Math.sin(angle) * (radius + barLen);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  bassEnergy: number,
  color: string
) {
  const particleCount = 28;
  ctx.save();

  for (let i = 0; i < particleCount; i++) {
    const seed = i * 137.5;
    const speed = 0.4 + (i % 5) * 0.2;
    const x = (Math.sin(time * speed + seed) * 0.5 + 0.5) * width;
    const y = ((time * speed * 25 + seed) % height);
    const size = (1.5 + (i % 3)) * (1 + bassEnergy * 0.8);

    ctx.fillStyle = color || 'rgba(245, 158, 11, 0.45)';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Renders the optional SpinningVinyl credit badge.
 */
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  customText?: string
) {
  ctx.save();

  // Bottom-right stylish watermark badge
  const badgeWidth = Math.min(width * 0.45, 290);
  const badgeHeight = 44;
  const paddingX = 20;
  const paddingY = 20;
  const bx = width - badgeWidth - paddingX;
  const by = height - badgeHeight - paddingY;

  // Background capsule
  ctx.fillStyle = 'rgba(11, 13, 17, 0.82)';
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bx, by, badgeWidth, badgeHeight, 8);
  ctx.fill();
  ctx.stroke();

  // Watermark logo mark (orange record)
  const iconX = bx + 22;
  const iconY = by + badgeHeight / 2;
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(iconX, iconY, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0b0d11';
  ctx.beginPath();
  ctx.arc(iconX, iconY, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Watermark text
  ctx.fillStyle = '#ffffff';
  ctx.font = "700 11px 'Plus Jakarta Sans', sans-serif";
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(customText || 'MADE WITH SPINNINGVINYL', bx + 42, by + 19);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.font = "500 9px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText('Music Video & Visualizer Studio', bx + 42, by + 32);

  ctx.restore();
}
