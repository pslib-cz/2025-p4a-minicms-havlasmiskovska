"use client";

import React from "react";
import { Card as RBCard, Badge as RBBadge } from "react-bootstrap";

export function BSCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <RBCard className={className}><RBCard.Body>{children}</RBCard.Body></RBCard>;
}

export function BSBadge({ children, className, bg }: { children: React.ReactNode; className?: string; bg?: string }) {
  return <RBBadge className={className} bg={bg ?? "secondary"}>{children}</RBBadge>;
}
