"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge, Button, Card, Form } from "react-bootstrap";

type Event = {
  id: string;
  name: string;
  tags: string[];
  expectedEffect: string;
  descriptionHtml: string;
  startDate: Date;
  endDate: Date;
  user: {
    name: string | null;
  };
};

type PublishedDaysListProps = {
  initialEvents: Event[];
};

function toDateLabel(value: Date) {
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString().slice(0, 10);
}

export default function PublishedDaysList({ initialEvents }: PublishedDaysListProps) {
  const PAGE_SIZE = 6;
  const [searchName, setSearchName] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedImpact, setSelectedImpact] = useState<Set<string>>(new Set(["POSITIVE", "NEGATIVE"]));
  const [currentPage, setCurrentPage] = useState(1);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    initialEvents.forEach((event) => {
      event.tags.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [initialEvents]);

  const filteredEvents = useMemo(() => {
    return initialEvents.filter((event) => {
      if (searchName.trim().length > 0) {
        const lowerName = searchName.toLowerCase();
        if (
          !event.name.toLowerCase().includes(lowerName) &&
          !event.descriptionHtml.toLowerCase().includes(lowerName)
        ) {
          return false;
        }
      }
      if (selectedImpact.size > 0 && !selectedImpact.has(event.expectedEffect)) {
        return false;
      }
      if (selectedTags.size > 0) {
        const hasTag = event.tags.some((tag) => selectedTags.has(tag));
        if (!hasTag) return false;
      }
      return true;
    });
  }, [initialEvents, searchName, selectedTags, selectedImpact]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedEvents = filteredEvents.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE,
  );

  function toggleTag(tag: string) {
    const newTags = new Set(selectedTags);
    if (newTags.has(tag)) newTags.delete(tag);
    else newTags.add(tag);
    setSelectedTags(newTags);
    setCurrentPage(1);
  }

  function toggleImpact(impact: string) {
    const newImpact = new Set(selectedImpact);
    if (newImpact.has(impact)) newImpact.delete(impact);
    else newImpact.add(impact);
    setSelectedImpact(newImpact);
    setCurrentPage(1);
  }

  const hasActiveFilters = searchName || selectedTags.size > 0 || selectedImpact.size < 2;

  return (
    <div className="row g-4">

      {/* Filters — compact bar on mobile, sidebar on desktop */}
      <aside className="col-12 col-md-3">

        {/* Mobile: single compact card */}
        <Card className="d-md-none border-0 shadow-sm">
          <Card.Body className="py-2 px-3">
            <Form.Control
              type="text"
              placeholder="Search..."
              value={searchName}
              onChange={(e) => { setSearchName(e.target.value); setCurrentPage(1); }}
              size="sm"
              className="mb-2"
            />
            <div className="d-flex flex-wrap align-items-center gap-3">
              <div className="d-flex align-items-center gap-2">
                <small className="text-muted fw-semibold">Impact:</small>
                <Form.Check
                  inline
                  type="checkbox"
                  id="m-impact-positive"
                  label="Positive"
                  checked={selectedImpact.has("POSITIVE")}
                  onChange={() => toggleImpact("POSITIVE")}
                  className="mb-0"
                />
                <Form.Check
                  inline
                  type="checkbox"
                  id="m-impact-negative"
                  label="Negative"
                  checked={selectedImpact.has("NEGATIVE")}
                  onChange={() => toggleImpact("NEGATIVE")}
                  className="mb-0"
                />
              </div>
              {allTags.length > 0 && (
                <div className="d-flex flex-wrap gap-1">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`btn btn-sm py-0 px-2 ${selectedTags.has(tag) ? "btn-primary" : "btn-outline-secondary"}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn btn-sm btn-link text-danger p-0 ms-auto"
                  onClick={() => {
                    setSearchName("");
                    setSelectedTags(new Set());
                    setSelectedImpact(new Set(["POSITIVE", "NEGATIVE"]));
                    setCurrentPage(1);
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </Card.Body>
        </Card>

        {/* Desktop: full sidebar */}
        <div className="d-none d-md-flex flex-column gap-3">
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <h6 className="text-uppercase fw-bold text-muted small mb-2">Search</h6>
              <Form.Control
                type="text"
                placeholder="Search by name or content..."
                value={searchName}
                onChange={(e) => { setSearchName(e.target.value); setCurrentPage(1); }}
                size="sm"
              />
            </Card.Body>
          </Card>

          <Card className="border-0 shadow-sm">
            <Card.Body>
              <h6 className="text-uppercase fw-bold text-muted small mb-2">Impact</h6>
              <Form.Check
                type="checkbox"
                id="impact-positive"
                label="Positive"
                checked={selectedImpact.has("POSITIVE")}
                onChange={() => toggleImpact("POSITIVE")}
                className="mb-1"
              />
              <Form.Check
                type="checkbox"
                id="impact-negative"
                label="Negative"
                checked={selectedImpact.has("NEGATIVE")}
                onChange={() => toggleImpact("NEGATIVE")}
              />
            </Card.Body>
          </Card>

          {allTags.length > 0 && (
            <Card className="border-0 shadow-sm">
              <Card.Body>
                <h6 className="text-uppercase fw-bold text-muted small mb-2">Tags</h6>
                {allTags.map((tag) => (
                  <Form.Check
                    key={tag}
                    type="checkbox"
                    id={`tag-${tag}`}
                    label={tag}
                    checked={selectedTags.has(tag)}
                    onChange={() => toggleTag(tag)}
                    className="mb-1"
                  />
                ))}
              </Card.Body>
            </Card>
          )}

          {hasActiveFilters && (
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => {
                setSearchName("");
                setSelectedTags(new Set());
                setSelectedImpact(new Set(["POSITIVE", "NEGATIVE"]));
                setCurrentPage(1);
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      </aside>

      {/* Events list */}
      <section className="col-12 col-md-9">
        {filteredEvents.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <Card.Body className="text-center py-5 text-muted">
              No published days found matching your filters.
            </Card.Body>
          </Card>
        ) : (
          <>
            <p className="text-muted small mb-3">
              Showing {(safeCurrentPage - 1) * PAGE_SIZE + 1}–{Math.min(safeCurrentPage * PAGE_SIZE, filteredEvents.length)} of {filteredEvents.length}
            </p>

            <div className="d-flex flex-column gap-3">
              {pagedEvents.map((event) => (
                <Card key={event.id} className="border-0 shadow-sm">
                  <Card.Body>
                    <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start mb-1 gap-1">
                      <h2 className="h5 fw-bold mb-0">{event.name}</h2>
                      <span className="text-muted small text-nowrap">
                        {toDateLabel(event.startDate)}
                        {toDateLabel(event.startDate) !== toDateLabel(event.endDate)
                          ? ` – ${toDateLabel(event.endDate)}`
                          : ""}
                      </span>
                    </div>

                    <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                      <Badge bg={event.expectedEffect === "POSITIVE" ? "success" : "danger"}>
                        {event.expectedEffect === "POSITIVE" ? "✓ Positive" : "✗ Negative"}
                      </Badge>
                      {event.user.name && (
                        <span className="text-muted small fst-italic">by {event.user.name}</span>
                      )}
                    </div>

                    {event.tags.length > 0 && (
                      <div className="d-flex flex-wrap gap-1 mb-2">
                        {event.tags.map((tag) => (
                          <Badge key={tag} bg="info" text="dark" className="fw-normal">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div
                      className="text-secondary small mb-3"
                      style={{
                        maxHeight: "100px",
                        overflow: "hidden",
                        maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
                        WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
                      }}
                      dangerouslySetInnerHTML={{ __html: event.descriptionHtml }}
                    />

                    <Link href={`/published-days/${event.id}`} className="btn btn-sm btn-outline-primary">
                      Read full details →
                    </Link>
                  </Card.Body>
                </Card>
              ))}
            </div>

            <nav className="d-flex justify-content-center align-items-center gap-3 mt-4" aria-label="Published days pages">
              <Button
                variant="outline-secondary"
                size="sm"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((v) => Math.max(1, v - 1))}
              >
                ← Previous
              </Button>
              <span className="text-muted small">
                Page {safeCurrentPage} of {totalPages}
              </span>
              <Button
                variant="outline-secondary"
                size="sm"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((v) => Math.min(totalPages, v + 1))}
              >
                Next →
              </Button>
            </nav>
          </>
        )}
      </section>
    </div>
  );
}
