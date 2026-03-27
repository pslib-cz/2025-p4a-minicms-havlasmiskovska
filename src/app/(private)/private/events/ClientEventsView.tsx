"use client";

import React from "react";
import { Container, Card, Badge, Button, Row, Col } from "react-bootstrap";
import Link from "next/link";

type MetricInsight = {
  trend: "better" | "worsen";
  percent: number;
};

type EventRow = {
  id: string;
  name: string;
  tags: string[];
  expectedEffect: "POSITIVE" | "NEGATIVE";
  startDate: Date | string;
  endDate: Date | string;
  descriptionHtml: string;
};

type Props = {
  events: EventRow[];
  stressInsights: Record<string, MetricInsight>;
  respirationInsights: Record<string, MetricInsight>;
  bodyBatteryInsights: Record<string, MetricInsight>;
};

function toDateLabel(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

export default function ClientEventsView({
  events,
  stressInsights,
  respirationInsights,
  bodyBatteryInsights
}: Props) {
  return (
    <Container className="py-4">
      <header className="mb-5">
        <p className="text-uppercase text-primary fw-bold mb-1">Important Days</p>
        <h1 className="display-5 fw-bold mb-3">Events Dashboard (React Bootstrap)</h1>
        <p className="lead text-muted">
          Create events that may affect your stress, respiration, or body battery trends.
        </p>
      </header>

      <div className="mb-4">
        <Link href="/private/events/new" passHref legacyBehavior>
          <Button variant="primary" size="lg">Create Important Day</Button>
        </Link>
      </div>

      <section>
        {events.length === 0 ? (
          <p className="text-muted">No important days yet.</p>
        ) : (
          events.map((event) => {
            const stress = stressInsights[event.id];
            const bodyBattery = bodyBatteryInsights[event.id];
            const respiration = respirationInsights[event.id];

            return (
              <Card key={event.id} className="mb-4 shadow-sm border-0">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <Card.Title className="mb-0 fw-bold fs-4">{event.name}</Card.Title>
                    <Badge bg={event.expectedEffect === "POSITIVE" ? "success" : "danger"} className="p-2">
                      {event.expectedEffect === "POSITIVE" ? "Positive" : "Negative"}
                    </Badge>
                  </div>

                  <Card.Subtitle className="mb-3 text-muted">
                    {toDateLabel(event.startDate)}
                    {toDateLabel(event.startDate) !== toDateLabel(event.endDate)
                      ? ` - ${toDateLabel(event.endDate)}`
                      : ""}
                  </Card.Subtitle>

                  {event.descriptionHtml && (
                    <div 
                      className="mb-4 text-dark lh-lg" 
                      dangerouslySetInnerHTML={{ __html: event.descriptionHtml }} 
                    />
                  )}

                  {(stress || bodyBattery || respiration) && (
                    <div className="mb-4 p-3 bg-light rounded-3 border-0">
                      <p className="fw-bold mb-2 small text-uppercase text-secondary">Metric Insights</p>
                      {stress && (
                        <p className="mb-1">
                          <span>Stress:</span> Trend turned <Badge bg={stress.trend === "better" ? "success" : "danger"} className="mx-1">{stress.trend}</Badge> by <strong>{stress.percent.toFixed(1)}%</strong>
                        </p>
                      )}

                      {bodyBattery && (
                        <p className="mb-1">
                          <span>Body Battery:</span> Trend turned <Badge bg={bodyBattery.trend === "better" ? "success" : "danger"} className="mx-1">{bodyBattery.trend}</Badge> by <strong>{bodyBattery.percent.toFixed(1)}%</strong>
                        </p>
                      )}

                      {respiration && (
                        <p className="mb-0">
                          <span>Respiration:</span> Trend turned <Badge bg={respiration.trend === "better" ? "success" : "danger"} className="mx-1">{respiration.trend}</Badge> by <strong>{respiration.percent.toFixed(1)}%</strong>
                        </p>
                      )}
                    </div>
                  )}

                  <div className="d-flex flex-wrap gap-2 mb-3">
                    {event.tags.map((tag) => (
                      <Badge bg="secondary" pill key={tag}>{tag}</Badge>
                    ))}
                  </div>

                  <Link href={`/private/events/${event.id}`} passHref legacyBehavior>
                    <Button variant="outline-primary">View Insights Details</Button>
                  </Link>
                </Card.Body>
              </Card>
            );
          })
        )}
      </section>
    </Container>
  );
}
