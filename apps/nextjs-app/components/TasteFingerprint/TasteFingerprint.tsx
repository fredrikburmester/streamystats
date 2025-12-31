"use client";

import { Download, Share2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { TasteProfile } from "@/lib/db/taste-profile";

interface TasteFingerprintProps {
  profile: TasteProfile;
  size?: number;
  contentScale?: number; // 0-1, scales inner content (rings/core) based on watch time
  animated?: boolean;
  showControls?: boolean;
}

function seededRandom(initialSeed: number) {
  let seed = initialSeed;
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

export function TasteFingerprint({
  profile,
  size = 500,
  contentScale = 1,
  animated = true,
  showControls = true,
}: TasteFingerprintProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [isHovered, setIsHovered] = useState(false);

  const drawFingerprint = useCallback(
    (ctx: CanvasRenderingContext2D, time = 0) => {
      const {
        dominantHue,
        secondaryHue,
        complexity,
        visualSeed,
        genreWeights,
        embedding,
      } = profile;
      const random = seededRandom(visualSeed);
      const centerX = size / 2;
      const centerY = size / 2;

      // Fixed constellation radius - acts as a reference frame (smaller for more margin)
      const constellationRadius = size * 0.36;
      // Inner content radius scales based on watch time (contentScale prop)
      const maxRadius = size * 0.32 * contentScale;

      // Background color
      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(0, 0, size, size);

      // Background gradient
      const bgGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        constellationRadius * 1.1,
      );
      bgGradient.addColorStop(0, `hsla(${dominantHue}, 60%, 15%, 0.8)`);
      bgGradient.addColorStop(0.5, `hsla(${secondaryHue}, 40%, 8%, 0.6)`);
      bgGradient.addColorStop(1, "transparent");
      ctx.fillStyle = bgGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, constellationRadius * 1.1, 0, Math.PI * 2);
      ctx.fill();

      // Outer constellation - genre nodes at FIXED radius (reference frame)
      const genres = Object.entries(genreWeights)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12);

      // Calculate node positions - fixed distance from center
      const genreNodes: { x: number; y: number; size: number; hue: number }[] =
        [];
      const genreAngleStep = (Math.PI * 2) / Math.max(genres.length, 1);

      genres.forEach(([_genre, weight], i) => {
        const angle = i * genreAngleStep - Math.PI / 2;
        // Fixed radius with slight variation for organic feel
        const radiusVariation = 0.95 + weight * 0.05;
        const nodeRadius = constellationRadius * radiusVariation;
        const x = centerX + Math.cos(angle) * nodeRadius;
        const y = centerY + Math.sin(angle) * nodeRadius;
        // Fixed node sizes (not scaled with fingerprint size)
        const nodeSize = 4 + weight * 6;
        const hue = (dominantHue + i * 30) % 360;

        genreNodes.push({ x, y, size: nodeSize, hue });
      });

      // Draw connecting lines between adjacent nodes
      if (genreNodes.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = `hsla(${dominantHue}, 40%, 60%, 0.15)`;
        ctx.lineWidth = 1;

        for (let i = 0; i < genreNodes.length; i++) {
          const current = genreNodes[i];
          const next = genreNodes[(i + 1) % genreNodes.length];
          ctx.moveTo(current.x, current.y);
          ctx.lineTo(next.x, next.y);
        }
        ctx.stroke();

        // Draw some cross-connections for larger constellations
        if (genreNodes.length >= 6) {
          ctx.beginPath();
          ctx.strokeStyle = `hsla(${secondaryHue}, 30%, 50%, 0.08)`;
          for (let i = 0; i < genreNodes.length; i += 2) {
            const current = genreNodes[i];
            const opposite =
              genreNodes[
                (i + Math.floor(genreNodes.length / 2)) % genreNodes.length
              ];
            ctx.moveTo(current.x, current.y);
            ctx.lineTo(opposite.x, opposite.y);
          }
          ctx.stroke();
        }
      }

      // Draw the genre nodes (glowing orbs)
      genreNodes.forEach((node, _i) => {
        // Outer glow
        const glowGrad = ctx.createRadialGradient(
          node.x,
          node.y,
          0,
          node.x,
          node.y,
          node.size * 3,
        );
        glowGrad.addColorStop(0, `hsla(${node.hue}, 70%, 60%, 0.4)`);
        glowGrad.addColorStop(0.5, `hsla(${node.hue}, 60%, 50%, 0.1)`);
        glowGrad.addColorStop(1, "transparent");

        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size * 3, 0, Math.PI * 2);
        ctx.fill();

        // Core node
        const coreGrad = ctx.createRadialGradient(
          node.x - node.size * 0.2,
          node.y - node.size * 0.2,
          0,
          node.x,
          node.y,
          node.size,
        );
        coreGrad.addColorStop(0, `hsla(${node.hue}, 60%, 85%, 1)`);
        coreGrad.addColorStop(0.6, `hsla(${node.hue}, 70%, 60%, 1)`);
        coreGrad.addColorStop(1, `hsla(${node.hue}, 70%, 40%, 0.8)`);

        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // DNA-like helix rings
      if (embedding && embedding.length > 0) {
        const numRings = 5;
        const samplesPerRing = 64;

        for (let ring = 0; ring < numRings; ring++) {
          const ringRadius = maxRadius * (0.3 + ring * 0.12);
          const ringOffset = ring * (embedding.length / numRings);
          const alpha = 0.4 - ring * 0.06;

          ctx.beginPath();
          for (let i = 0; i <= samplesPerRing; i++) {
            const angle = (i / samplesPerRing) * Math.PI * 2;
            const embIdx = Math.floor((ringOffset + i * 3) % embedding.length);
            const embValue = embedding[embIdx];
            const wobble = embValue * maxRadius * 0.08;
            const animWobble = animated
              ? Math.sin(time * 0.001 + i * 0.1) * 2
              : 0;
            const r = ringRadius + wobble + animWobble;

            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();

          const ringHue = (dominantHue + ring * 40) % 360;
          ctx.strokeStyle = `hsla(${ringHue}, 60%, 60%, ${alpha})`;
          ctx.lineWidth = 1.5 + complexity * 1.5;
          ctx.stroke();
        }
      }

      // Core orb with glow
      const coreRadius = maxRadius * 0.15;
      const pulseScale = animated ? 1 + Math.sin(time * 0.002) * 0.05 : 1;

      const glowGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        coreRadius * 3 * pulseScale,
      );
      glowGradient.addColorStop(0, `hsla(${dominantHue}, 80%, 60%, 0.4)`);
      glowGradient.addColorStop(0.5, `hsla(${secondaryHue}, 60%, 40%, 0.2)`);
      glowGradient.addColorStop(1, "transparent");

      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius * 3 * pulseScale, 0, Math.PI * 2);
      ctx.fill();

      const coreGradient = ctx.createRadialGradient(
        centerX - coreRadius * 0.3,
        centerY - coreRadius * 0.3,
        0,
        centerX,
        centerY,
        coreRadius * pulseScale,
      );
      coreGradient.addColorStop(0, `hsla(${dominantHue}, 70%, 80%, 1)`);
      coreGradient.addColorStop(0.6, `hsla(${dominantHue}, 80%, 50%, 1)`);
      coreGradient.addColorStop(1, `hsla(${secondaryHue}, 70%, 30%, 1)`);

      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius * pulseScale, 0, Math.PI * 2);
      ctx.fill();

      // Floating particles
      if (embedding) {
        const numParticles = Math.min(profile.topItems.length, 15);
        for (let i = 0; i < numParticles; i++) {
          const baseAngle = random() * Math.PI * 2;
          const baseRadius = maxRadius * (0.5 + random() * 0.3);
          const animOffset = animated ? Math.sin(time * 0.001 + i) * 5 : 0;

          const x = centerX + Math.cos(baseAngle) * (baseRadius + animOffset);
          const y = centerY + Math.sin(baseAngle) * (baseRadius + animOffset);
          const particleSize = 2 + random() * 3;
          const particleHue = (dominantHue + random() * 60) % 360;

          ctx.fillStyle = `hsla(${particleHue}, 60%, 70%, ${
            0.5 + random() * 0.3
          })`;
          ctx.beginPath();
          ctx.arc(x, y, particleSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Signature hash pattern
      if (visualSeed > 0) {
        ctx.save();
        ctx.globalAlpha = 0.15;
        const hashRandom = seededRandom(visualSeed);
        const numLines = 8;

        for (let i = 0; i < numLines; i++) {
          const startAngle = hashRandom() * Math.PI * 2;
          const endAngle = startAngle + Math.PI * (0.5 + hashRandom() * 0.5);
          const lineRadius = maxRadius * (0.6 + hashRandom() * 0.2);

          ctx.beginPath();
          ctx.arc(centerX, centerY, lineRadius, startAngle, endAngle);
          ctx.strokeStyle = `hsla(${dominantHue}, 50%, 70%, 0.3)`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.restore();
      }
    },
    [profile, size, contentScale, animated],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    if (animated) {
      const animate = (time: number) => {
        drawFingerprint(ctx, time);
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      drawFingerprint(ctx, 0);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [drawFingerprint, animated, size]);

  const downloadImage = useCallback(() => {
    const exportCanvas = document.createElement("canvas");
    const exportSize = 1200;
    exportCanvas.width = exportSize;
    exportCanvas.height = exportSize;
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) return;

    exportCtx.scale(exportSize / size, exportSize / size);
    drawFingerprint(exportCtx, 0);

    exportCtx.setTransform(1, 0, 0, 1, 0, 0);
    exportCtx.fillStyle = "rgba(255, 255, 255, 0.5)";
    exportCtx.font = "bold 24px system-ui";
    exportCtx.textAlign = "center";
    exportCtx.fillText(`@${profile.userName}`, exportSize / 2, exportSize - 40);
    exportCtx.font = "16px system-ui";
    exportCtx.fillStyle = "rgba(255, 255, 255, 0.3)";
    exportCtx.fillText(
      "Streamystats Taste Fingerprint",
      exportSize / 2,
      exportSize - 16,
    );

    const link = document.createElement("a");
    link.download = `taste-fingerprint-${profile.userName}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  }, [profile, size, drawFingerprint]);

  const shareFingerprint = useCallback(async () => {
    const exportCanvas = document.createElement("canvas");
    const exportSize = 1200;
    exportCanvas.width = exportSize;
    exportCanvas.height = exportSize;
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) return;

    exportCtx.scale(exportSize / size, exportSize / size);
    drawFingerprint(exportCtx, 0);

    exportCtx.setTransform(1, 0, 0, 1, 0, 0);
    exportCtx.fillStyle = "rgba(255, 255, 255, 0.5)";
    exportCtx.font = "bold 24px system-ui";
    exportCtx.textAlign = "center";
    exportCtx.fillText(`@${profile.userName}`, exportSize / 2, exportSize - 40);
    exportCtx.font = "16px system-ui";
    exportCtx.fillStyle = "rgba(255, 255, 255, 0.3)";
    exportCtx.fillText(
      "Streamystats Taste Fingerprint",
      exportSize / 2,
      exportSize - 16,
    );

    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        exportCanvas.toBlob(resolve, "image/png"),
      );

      if (blob && navigator.share) {
        const file = new File(
          [blob],
          `taste-fingerprint-${profile.userName}.png`,
          {
            type: "image/png",
          },
        );

        await navigator.share({
          title: `${profile.userName}'s Taste Fingerprint`,
          text: "Check out my unique watching fingerprint on Streamystats!",
          files: [file],
        });
      } else {
        downloadImage();
      }
    } catch {
      downloadImage();
    }
  }, [profile, size, drawFingerprint, downloadImage]);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        role="img"
        aria-label="Taste fingerprint visualization"
        className="relative rounded-2xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: "#0A0A0A" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <canvas
          ref={canvasRef}
          className="block transition-transform duration-300"
          style={{
            transform: isHovered ? "scale(1.02)" : "scale(1)",
          }}
        />

        <div className="absolute bottom-4 left-4 right-4 flex justify-between text-xs text-white/50">
          <span>{profile.itemCount} items</span>
          <span>{Math.round(profile.totalWatchTime / 3600)}h watched</span>
        </div>
      </div>

      {showControls && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadImage}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          <Button variant="outline" size="sm" onClick={shareFingerprint}>
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>
      )}
    </div>
  );
}
