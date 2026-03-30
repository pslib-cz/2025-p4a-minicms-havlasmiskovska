"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Container,
    Card,
    Badge,
    Button,
    Form,
    Spinner,
    Modal,
} from "react-bootstrap";
import Link from "next/link";

type EventRow = {
    id: string;
    name: string;
    title: string;
    tags: string[];
    expectedEffect: "POSITIVE" | "NEGATIVE";
    visibility: "PUBLISHED" | "NOT_PUBLIC" | "PRIVATE";
    startDate: string;
    endDate: string;
    descriptionHtml: string;
    categories: Array<{ id: string; name: string; slug: string }>;
};

type PaginationInfo = {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
};

type ApiResponse = {
    data: EventRow[];
    pagination: PaginationInfo;
};

function toDateLabel(value: string) {
    return new Date(value).toISOString().slice(0, 10);
}

export default function ClientEventsView() {
    const [events, setEvents] = useState<EventRow[]>([]);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 1,
    });
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [loading, setLoading] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState<EventRow | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchEvents = useCallback(
        async (page: number, searchQuery: string) => {
            setLoading(true);
            try {
                const params = new URLSearchParams({
                    page: String(page),
                    pageSize: "10",
                });
                if (searchQuery) params.set("search", searchQuery);

                const res = await fetch(`/api/events?${params.toString()}`);
                if (!res.ok) throw new Error("Failed to fetch events");

                const data: ApiResponse = await res.json();
                setEvents(data.data);
                setPagination(data.pagination);
            } catch {
                setEvents([]);
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    useEffect(() => {
        void fetchEvents(1, "");
    }, [fetchEvents]);

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        setSearch(searchInput);
        void fetchEvents(1, searchInput);
    }

    function handlePageChange(newPage: number) {
        void fetchEvents(newPage, search);
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/events/${deleteTarget.id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete");
            setDeleteTarget(null);
            void fetchEvents(pagination.page, search);
        } catch {
            alert("Failed to delete event");
        } finally {
            setDeleting(false);
        }
    }

    return (
        <Container className="py-4">
            <header className="mb-5">
                <p className="text-uppercase text-primary fw-bold mb-1">
                    Important Days
                </p>
                <h1 className="display-5 fw-bold mb-3">Events Dashboard</h1>
                <p className="lead text-muted">
                    Create events that may affect your stress, respiration, or
                    body battery trends.
                </p>
            </header>

            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                <Link
                    href="/private/events/new"
                    className="btn btn-primary btn-lg"
                >
                    Create Important Day
                </Link>
                <Form
                    onSubmit={handleSearch}
                    className="d-flex gap-2"
                    style={{ maxWidth: 360 }}
                >
                    <Form.Control
                        type="text"
                        placeholder="Search events..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                    />
                    <Button type="submit" variant="outline-secondary">
                        Search
                    </Button>
                </Form>
            </div>

            {loading ? (
                <div className="text-center py-5">
                    <Spinner animation="border" />
                </div>
            ) : events.length === 0 ? (
                <p className="text-muted">No important days found.</p>
            ) : (
                <>
                    <p className="text-muted small mb-3">
                        Showing{" "}
                        {(pagination.page - 1) * pagination.pageSize + 1}–
                        {Math.min(
                            pagination.page * pagination.pageSize,
                            pagination.total,
                        )}{" "}
                        of {pagination.total}
                    </p>

                    {events.map((event) => (
                        <Card
                            key={event.id}
                            className="mb-4 shadow-sm border-0"
                        >
                            <Card.Body>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <Card.Title className="mb-0 fw-bold fs-4">
                                        {event.name}
                                    </Card.Title>
                                    <div className="d-flex gap-2">
                                        <Badge
                                            bg={
                                                event.expectedEffect ===
                                                "POSITIVE"
                                                    ? "success"
                                                    : "danger"
                                            }
                                            className="p-2"
                                        >
                                            {event.expectedEffect === "POSITIVE"
                                                ? "Positive"
                                                : "Negative"}
                                        </Badge>
                                        <Badge bg="secondary" className="p-2">
                                            {event.visibility.replace("_", " ")}
                                        </Badge>
                                    </div>
                                </div>

                                <Card.Subtitle className="mb-3 text-muted">
                                    {toDateLabel(event.startDate)}
                                    {toDateLabel(event.startDate) !==
                                    toDateLabel(event.endDate)
                                        ? ` – ${toDateLabel(event.endDate)}`
                                        : ""}
                                </Card.Subtitle>

                                {event.descriptionHtml && (
                                    <div
                                        className="mb-3 text-dark"
                                        style={{
                                            maxHeight: "100px",
                                            overflow: "hidden",
                                            maskImage:
                                                "linear-gradient(to bottom, black 60%, transparent)",
                                            WebkitMaskImage:
                                                "linear-gradient(to bottom, black 60%, transparent)",
                                        }}
                                        dangerouslySetInnerHTML={{
                                            __html: event.descriptionHtml,
                                        }}
                                    />
                                )}

                                <div className="d-flex flex-wrap gap-2 mb-3">
                                    {event.tags.map((tag) => (
                                        <Badge
                                            bg="info"
                                            text="dark"
                                            pill
                                            key={tag}
                                        >
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>

                                <div className="d-flex flex-wrap gap-2">
                                    <Link
                                        href={`/private/events/${event.id}`}
                                        className="btn btn-outline-primary btn-sm"
                                    >
                                        View Details
                                    </Link>
                                    <Link
                                        href={`/private/events/${event.id}/edit`}
                                        className="btn btn-outline-secondary btn-sm"
                                    >
                                        Edit
                                    </Link>
                                    <Button
                                        variant="outline-danger"
                                        size="sm"
                                        onClick={() => setDeleteTarget(event)}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </Card.Body>
                        </Card>
                    ))}

                    <nav className="d-flex justify-content-center align-items-center gap-3 mt-4">
                        <Button
                            variant="outline-secondary"
                            size="sm"
                            disabled={pagination.page <= 1}
                            onClick={() =>
                                handlePageChange(pagination.page - 1)
                            }
                        >
                            ← Previous
                        </Button>
                        <span className="text-muted small">
                            Page {pagination.page} of {pagination.totalPages}
                        </span>
                        <Button
                            variant="outline-secondary"
                            size="sm"
                            disabled={pagination.page >= pagination.totalPages}
                            onClick={() =>
                                handlePageChange(pagination.page + 1)
                            }
                        >
                            Next →
                        </Button>
                    </nav>
                </>
            )}

            <Modal
                show={!!deleteTarget}
                onHide={() => setDeleteTarget(null)}
                centered
            >
                <Modal.Header closeButton>
                    <Modal.Title>Delete Event</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    Are you sure you want to delete{" "}
                    <strong>{deleteTarget?.name}</strong>? This action cannot be
                    undone.
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        variant="secondary"
                        onClick={() => setDeleteTarget(null)}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        onClick={() => void handleDelete()}
                        disabled={deleting}
                    >
                        {deleting ? "Deleting..." : "Delete"}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
}
