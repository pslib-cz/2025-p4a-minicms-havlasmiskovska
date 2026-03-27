"use client";

import { useState } from "react";


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
    <div className="d-flex flex-wrap align-items-center mb-2">
      <label className="fw-bold d-inline-block me-2 mb-0" style={{ minWidth: '130px' }}>
        Visibility:
      </label>
      <select
        value={visibility}
        onChange={(e) => void handleChange(e.target.value)}
        disabled={isLoading}
        className="form-select form-select-sm w-auto d-inline-block shadow-sm cursor-pointer"
      >
        <option value="PRIVATE">Private</option>
        <option value="NOT_PUBLIC">Not Public</option>
        <option value="PUBLISHED">Published</option>
      </select>

      <div className="ms-3 d-flex align-items-center" style={{ minWidth: '100px' }}>
        {isLoading && <span className="spinner-border spinner-border-sm text-primary" role="status"></span>}
        {success && <span className="badge bg-success bg-opacity-10 text-success border border-success"><i className="bi bi-check2"></i> Updated</span>}
        {error && <span className="badge bg-danger bg-opacity-10 text-danger border border-danger">{error}</span>}
      </div>
    </div>
  );
}
