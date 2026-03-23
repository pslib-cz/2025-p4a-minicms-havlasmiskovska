"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import styles from "./published-days-list.module.css";

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

  // Collect all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    initialEvents.forEach((event) => {
      event.tags.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [initialEvents]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return initialEvents.filter((event) => {
      // Filter by name
      if (searchName.trim().length > 0) {
        const lowerName = searchName.toLowerCase();
        if (
          !event.name.toLowerCase().includes(lowerName) &&
          !event.descriptionHtml.toLowerCase().includes(lowerName)
        ) {
          return false;
        }
      }

      // Filter by impact
      if (selectedImpact.size > 0 && !selectedImpact.has(event.expectedEffect)) {
        return false;
      }

      // Filter by tags (OR logic - if tags selected, event must have at least one)
      if (selectedTags.size > 0) {
        const hasTag = event.tags.some((tag) => selectedTags.has(tag));
        if (!hasTag) {
          return false;
        }
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
    if (newTags.has(tag)) {
      newTags.delete(tag);
    } else {
      newTags.add(tag);
    }
    setSelectedTags(newTags);
    setCurrentPage(1);
  }

  function toggleImpact(impact: string) {
    const newImpact = new Set(selectedImpact);
    if (newImpact.has(impact)) {
      newImpact.delete(impact);
    } else {
      newImpact.add(impact);
    }
    setSelectedImpact(newImpact);
    setCurrentPage(1);
  }

  return (
    <div className={styles.wrapper}>
      <aside className={styles.sidebar}>
        <div className={styles.filterSection}>
          <h3 className={styles.filterTitle}>Search</h3>
          <input
            type="text"
            placeholder="Search by name or content..."
            value={searchName}
            onChange={(e) => {
              setSearchName(e.target.value);
              setCurrentPage(1);
            }}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filterSection}>
          <h3 className={styles.filterTitle}>Impact</h3>
          <label className={styles.filterCheckbox}>
            <input
              type="checkbox"
              checked={selectedImpact.has("POSITIVE")}
              onChange={() => toggleImpact("POSITIVE")}
            />
            <span>Positive</span>
          </label>
          <label className={styles.filterCheckbox}>
            <input
              type="checkbox"
              checked={selectedImpact.has("NEGATIVE")}
              onChange={() => toggleImpact("NEGATIVE")}
            />
            <span>Negative</span>
          </label>
        </div>

        {allTags.length > 0 && (
          <div className={styles.filterSection}>
            <h3 className={styles.filterTitle}>Tags</h3>
            <div className={styles.tagList}>
              {allTags.map((tag) => (
                <label key={tag} className={styles.filterCheckbox}>
                  <input
                    type="checkbox"
                    checked={selectedTags.has(tag)}
                    onChange={() => toggleTag(tag)}
                  />
                  <span>{tag}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {(searchName || selectedTags.size > 0 || selectedImpact.size < 2) && (
          <button
            onClick={() => {
              setSearchName("");
              setSelectedTags(new Set());
              setSelectedImpact(new Set(["POSITIVE", "NEGATIVE"]));
              setCurrentPage(1);
            }}
            className={styles.clearButton}
          >
            Clear Filters
          </button>
        )}
      </aside>

      <section className={styles.content}>
        {filteredEvents.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No published days found matching your filters.</p>
          </div>
        ) : (
          <>
            <div className={styles.eventsSummary}>
              Showing {(safeCurrentPage - 1) * PAGE_SIZE + 1}-{Math.min(safeCurrentPage * PAGE_SIZE, filteredEvents.length)} of {filteredEvents.length}
            </div>

            <div className={styles.eventsList}>
              {pagedEvents.map((event) => (
              <article key={event.id} className={styles.eventCard}>
                <header className={styles.eventHeader}>
                  <h2 className={styles.eventTitle}>{event.name}</h2>
                  <p className={styles.eventDate}>
                    {toDateLabel(event.startDate)}
                    {toDateLabel(event.startDate) !== toDateLabel(event.endDate)
                      ? ` - ${toDateLabel(event.endDate)}`
                      : ""}
                  </p>
                </header>

                <div className={styles.eventMeta}>
                  <span className={styles.impact}>
                    {event.expectedEffect === "POSITIVE" ? "✓ Positive" : "✗ Negative"}
                  </span>
                  {event.user.name && (
                    <span className={styles.author}>by {event.user.name}</span>
                  )}
                </div>

                {event.tags.length > 0 && (
                  <div className={styles.tagsRow}>
                    {event.tags.map((tag) => (
                      <span key={tag} className={styles.tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div
                  className={styles.description}
                  dangerouslySetInnerHTML={{ __html: event.descriptionHtml }}
                />

                <Link href={`/published-days/${event.id}`} className={styles.readMore}>
                  Read full details →
                </Link>
              </article>
              ))}
            </div>

            <nav className={styles.pagination} aria-label="Published days pages">
              <button
                type="button"
                className={styles.pageButton}
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </button>

              <span className={styles.pageIndicator}>
                Page {safeCurrentPage} of {totalPages}
              </span>

              <button
                type="button"
                className={styles.pageButton}
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))}
              >
                Next
              </button>
            </nav>
          </>
        )}
      </section>
    </div>
  );
}
