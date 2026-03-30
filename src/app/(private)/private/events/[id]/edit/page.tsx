"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Container, Form, Button, Card, Spinner } from "react-bootstrap";
import Link from "next/link";
import EventEditor from "../../new/event-editor";

type EventData = {
    id: string;
    name: string;
    tags: string[];
    expectedEffect: "POSITIVE" | "NEGATIVE";
    visibility: "PUBLISHED" | "NOT_PUBLIC" | "PRIVATE";
    startDate: string;
    endDate: string;
    descriptionHtml: string;
};

export default function EditEventPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const [event, setEvent] = useState<EventData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadEvent() {
            try {
                const res = await fetch(`/api/events/${params.id}`);
                if (!res.ok) throw new Error("Failed to load event");
                const json = await res.json();
                setEvent(json.data);
            } catch {
                setError("Could not load event");
            } finally {
                setLoading(false);
            }
        }
        void loadEvent();
    }, [params.id]);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!event) return;
        setSaving(true);
        setError(null);

        const form = new FormData(e.currentTarget);

        try {
            const res = await fetch(`/api/events/${params.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.get("name"),
                    tags: String(form.get("tags") || "")
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    expectedEffect: form.get("expectedEffect"),
                    visibility: form.get("visibility"),
                    startDate: form.get("startDate"),
                    endDate: form.get("endDate") || form.get("startDate"),
                    descriptionHtml: form.get("descriptionHtml") || "",
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to save");
            }

            router.push("/private/events");
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to save event",
            );
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <Container className="py-5 text-center">
                <Spinner animation="border" />
            </Container>
        );
    }

    if (!event) {
        return (
            <Container className="py-5">
                <div className="alert alert-danger">
                    {error || "Event not found"}
                </div>
                <Link
                    href="/private/events"
                    className="btn btn-outline-secondary"
                >
                    ← Back to Events
                </Link>
            </Container>
        );
    }

    const startDate = new Date(event.startDate).toISOString().slice(0, 10);
    const endDate = new Date(event.endDate).toISOString().slice(0, 10);

    return (
        <main className="min-vh-100 bg-light py-5">
            <Container>
                <header className="mb-5">
                    <p className="text-uppercase text-primary fw-bold mb-1">
                        Important Days
                    </p>
                    <h1 className="display-5 fw-bold mb-3">Edit Event</h1>
                </header>

                {error && <div className="alert alert-danger">{error}</div>}

                <Form onSubmit={handleSubmit}>
                    <Card className="shadow-sm border-0 mb-4 rounded-4 overflow-hidden">
                        <Card.Header className="bg-white border-bottom-0 pt-4 pb-0 px-4">
                            <h3 className="h5 mb-0 text-primary fw-bold">
                                Basic Information
                            </h3>
                        </Card.Header>
                        <Card.Body className="p-4">
                            <div className="row g-4">
                                <div className="col-md-6">
                                    <Form.Group>
                                        <Form.Label className="fw-bold text-secondary small text-uppercase">
                                            Event Name{" "}
                                            <span className="text-danger">
                                                *
                                            </span>
                                        </Form.Label>
                                        <Form.Control
                                            name="name"
                                            required
                                            defaultValue={event.name}
                                            className="form-control-lg bg-light border-0"
                                        />
                                    </Form.Group>
                                </div>
                                <div className="col-md-6">
                                    <Form.Group>
                                        <Form.Label className="fw-bold text-secondary small text-uppercase">
                                            Tags{" "}
                                            <span className="text-muted fw-normal text-capitalize">
                                                (comma separated)
                                            </span>
                                        </Form.Label>
                                        <Form.Control
                                            name="tags"
                                            defaultValue={event.tags.join(", ")}
                                            className="form-control-lg bg-light border-0"
                                        />
                                    </Form.Group>
                                </div>
                                <div className="col-md-6">
                                    <Form.Group>
                                        <Form.Label className="fw-bold text-secondary small text-uppercase">
                                            Start Date{" "}
                                            <span className="text-danger">
                                                *
                                            </span>
                                        </Form.Label>
                                        <Form.Control
                                            name="startDate"
                                            type="date"
                                            required
                                            defaultValue={startDate}
                                            className="form-control-lg bg-light border-0"
                                        />
                                    </Form.Group>
                                </div>
                                <div className="col-md-6">
                                    <Form.Group>
                                        <Form.Label className="fw-bold text-secondary small text-uppercase">
                                            End Date
                                        </Form.Label>
                                        <Form.Control
                                            name="endDate"
                                            type="date"
                                            defaultValue={endDate}
                                            className="form-control-lg bg-light border-0"
                                        />
                                    </Form.Group>
                                </div>
                                <div className="col-md-6">
                                    <Form.Group>
                                        <Form.Label className="fw-bold text-secondary small text-uppercase">
                                            Privacy Visibility
                                        </Form.Label>
                                        <Form.Select
                                            name="visibility"
                                            defaultValue={event.visibility}
                                            className="form-control-lg bg-light border-0"
                                        >
                                            <option value="PRIVATE">
                                                Private (Only you)
                                            </option>
                                            <option value="NOT_PUBLIC">
                                                Not Public (Link sharing)
                                            </option>
                                            <option value="PUBLISHED">
                                                Published (Visible to all)
                                            </option>
                                        </Form.Select>
                                    </Form.Group>
                                </div>
                            </div>
                        </Card.Body>
                    </Card>

                    <Card className="shadow-sm border-0 mb-4 rounded-4 overflow-hidden">
                        <Card.Header className="bg-white border-bottom-0 pt-4 pb-0 px-4">
                            <h3 className="h5 mb-0 text-primary fw-bold">
                                Event Impact Assessment
                            </h3>
                        </Card.Header>
                        <Card.Body className="p-4">
                            <fieldset className="p-3 bg-light rounded-3 border-0">
                                <legend className="fw-bold fs-6 text-dark mb-3">
                                    How do you think this event will affect you?
                                </legend>
                                <div className="d-flex gap-4">
                                    <Form.Check
                                        type="radio"
                                        name="expectedEffect"
                                        value="POSITIVE"
                                        label={
                                            <span className="text-success fw-bold">
                                                Positive impact
                                            </span>
                                        }
                                        id="edit-effect-positive"
                                        className="fs-5"
                                        defaultChecked={
                                            event.expectedEffect === "POSITIVE"
                                        }
                                    />
                                    <Form.Check
                                        type="radio"
                                        name="expectedEffect"
                                        value="NEGATIVE"
                                        label={
                                            <span className="text-danger fw-bold">
                                                Negative impact
                                            </span>
                                        }
                                        id="edit-effect-negative"
                                        className="fs-5"
                                        defaultChecked={
                                            event.expectedEffect === "NEGATIVE"
                                        }
                                    />
                                </div>
                            </fieldset>
                        </Card.Body>
                    </Card>

                    <Card className="shadow-sm border-0 mb-5 rounded-4 overflow-hidden">
                        <Card.Header className="bg-white border-bottom-0 pt-4 pb-0 px-4">
                            <h3 className="h5 mb-0 text-primary fw-bold">
                                What Happened
                            </h3>
                        </Card.Header>
                        <Card.Body className="p-4">
                            <EventEditor
                                name="descriptionHtml"
                                initialHtml={event.descriptionHtml}
                            />
                        </Card.Body>
                    </Card>

                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-3 bg-white p-4 shadow-sm border-0 rounded-4 mb-5">
                        <Link
                            href="/private/events"
                            className="btn btn-light btn-lg px-4 text-secondary fw-bold"
                        >
                            ← Back To Events
                        </Link>
                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            className="px-5 fw-bold shadow-sm"
                            disabled={saving}
                        >
                            {saving ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </Form>
            </Container>
        </main>
    );
}
