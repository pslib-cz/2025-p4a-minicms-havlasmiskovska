"use client";

import { useState } from "react";
import styles from "./visibility-selector.module.css";

type VisibilitySelectorProps = {
  eventId: string;
  currentVisibility: string;
};

export default function VisibilitySelector({ eventId, currentVisibility }: VisibilitySelectorProps) {
  const [visibility, setVisibility] = useState(currentVisibility);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleChange(newVisibility: string) {
    setVisibility(newVisibility);
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/events/update-visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          visibility: newVisibility,
        }),
      });

      if (!response.ok) {
        const data = await response.json() as { error: string };
        setError(data.error || "Failed to update visibility");
        setVisibility(currentVisibility);
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      }
    } catch (err) {
      setError("An error occurred");
      setVisibility(currentVisibility);
    } finally {
      setIsLoading(false);
    }
  }

  const labels: Record<string, string> = {
    PUBLISHED: "Published",
    NOT_PUBLIC: "Not Public",
    PRIVATE: "Private",
  };

  return (
    <div className={styles.container}>
      <label className={styles.label}>
        <span>Visibility:</span>
        <select
          value={visibility}
          onChange={(e) => void handleChange(e.target.value)}
          disabled={isLoading}
          className={styles.select}
        >
          <option value="PRIVATE">Private</option>
          <option value="NOT_PUBLIC">Not Public</option>
          <option value="PUBLISHED">Published</option>
        </select>
      </label>
      {error && <p className={styles.error}>{error}</p>}
      {success && <p className={styles.success}>Updated!</p>}
    </div>
  );
}
