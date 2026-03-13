"use client";

import { useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface SpotlightGridProps {
  children: React.ReactNode;
  className?: string;
  /** Glow color as RGB values, e.g. "59, 130, 246" for blue */
  glowColor?: string;
  /** Spotlight radius in px */
  spotlightRadius?: number;
}

/**
 * Wraps a grid of cards and adds a cursor-following spotlight glow effect.
 * Cards inside get a border glow when the cursor is near them.
 *
 * Usage: wrap any grid, and add `data-spotlight-card` to each card element.
 */
export function SpotlightGrid({
  children,
  className,
  glowColor = "59, 130, 246",
  spotlightRadius = 350,
}: SpotlightGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return;

      const cards = containerRef.current.querySelectorAll<HTMLElement>("[data-spotlight-card]");
      const rect = containerRef.current.getBoundingClientRect();

      // Check if mouse is inside the container
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        cards.forEach((card) => {
          card.style.setProperty("--spotlight-opacity", "0");
        });
        return;
      }

      cards.forEach((card) => {
        const cardRect = card.getBoundingClientRect();
        const cardCenterX = cardRect.left + cardRect.width / 2;
        const cardCenterY = cardRect.top + cardRect.height / 2;

        // Distance from cursor to card center, minus half the card diagonal
        const rawDistance = Math.hypot(e.clientX - cardCenterX, e.clientY - cardCenterY);
        const cardRadius = Math.max(cardRect.width, cardRect.height) / 2;
        const distance = Math.max(0, rawDistance - cardRadius);

        // Glow intensity based on proximity
        const proximity = spotlightRadius * 0.4;
        const fadeDistance = spotlightRadius * 0.8;
        let intensity = 0;
        if (distance <= proximity) {
          intensity = 1;
        } else if (distance <= fadeDistance) {
          intensity = (fadeDistance - distance) / (fadeDistance - proximity);
        }

        // Relative position within card for gradient origin
        const relX = ((e.clientX - cardRect.left) / cardRect.width) * 100;
        const relY = ((e.clientY - cardRect.top) / cardRect.height) * 100;

        card.style.setProperty("--spotlight-x", `${relX}%`);
        card.style.setProperty("--spotlight-y", `${relY}%`);
        card.style.setProperty("--spotlight-opacity", intensity.toString());
        card.style.setProperty("--spotlight-color", glowColor);
      });
    },
    [spotlightRadius, glowColor],
  );

  const handleMouseLeave = useCallback(() => {
    if (!containerRef.current) return;
    containerRef.current.querySelectorAll<HTMLElement>("[data-spotlight-card]").forEach((card) => {
      card.style.setProperty("--spotlight-opacity", "0");
    });
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {children}
    </div>
  );
}
