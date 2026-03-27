"use client";

import React from "react";
import { Form, Button } from "react-bootstrap";
import Link from "next/link";
import EventEditor from "./event-editor";

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (payload: any) => void;
};

export default function BootstrapEventForm({ action }: Props) {
  return (
    <Form action={action} className="needs-validation">
      <div className="card shadow-sm border-0 mb-4 rounded-4 overflow-hidden">
        <div className="card-header bg-white border-bottom-0 pt-4 pb-0 px-4">
          <h3 className="h5 mb-0 text-primary fw-bold">Basic Information</h3>
        </div>
        <div className="card-body p-4">
          <div className="row g-4">
            <div className="col-md-6">
              <Form.Group>
                <Form.Label className="fw-bold text-secondary small text-uppercase">Event Name <span className="text-danger">*</span></Form.Label>
                <Form.Control name="name" required placeholder="e.g. Final Exams Week" className="form-control-lg bg-light border-0" />
              </Form.Group>
            </div>

            <div className="col-md-6">
              <Form.Group>
                <Form.Label className="fw-bold text-secondary small text-uppercase">Tags <span className="text-muted fw-normal text-capitalize">(comma separated)</span></Form.Label>
                <Form.Control name="tags" placeholder="school, work, family" className="form-control-lg bg-light border-0" />
              </Form.Group>
            </div>

            <div className="col-md-6">
              <Form.Group>
                <Form.Label className="fw-bold text-secondary small text-uppercase">Start Date <span className="text-danger">*</span></Form.Label>
                <Form.Control name="startDate" type="date" required className="form-control-lg bg-light border-0" />
              </Form.Group>
            </div>

            <div className="col-md-6">
              <Form.Group>
                <Form.Label className="fw-bold text-secondary small text-uppercase">End Date</Form.Label>
                <Form.Control name="endDate" type="date" className="form-control-lg bg-light border-0" />
              </Form.Group>
            </div>
            
            <div className="col-md-6">
              <Form.Group>
                <Form.Label className="fw-bold text-secondary small text-uppercase">Privacy Visibility</Form.Label>
                <Form.Select name="visibility" defaultValue="NOT_PUBLIC" className="form-control-lg bg-light border-0 cursor-pointer">
                  <option value="PRIVATE">Private (Only you)</option>
                  <option value="NOT_PUBLIC">Not Public (Link sharing)</option>
                  <option value="PUBLISHED">Published (Visible to all)</option>
                </Form.Select>
              </Form.Group>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-4 rounded-4 overflow-hidden">
        <div className="card-header bg-white border-bottom-0 pt-4 pb-0 px-4">
          <h3 className="h5 mb-0 text-primary fw-bold">Event Impact Assessment</h3>
        </div>
        <div className="card-body p-4">
          <fieldset className="p-3 bg-light rounded-3 border-0">
            <legend className="fw-bold fs-6 text-dark mb-3">How do you think this event will affect you?</legend>
            <div className="d-flex gap-4">
              <div className="form-check form-check-inline custom-radio">
                <Form.Check 
                  type="radio" 
                  name="expectedEffect" 
                  value="POSITIVE" 
                  label={<span className="text-success fw-bold">Positive impact</span>}
                  id="effect-positive" 
                  className="fs-5"
                />
              </div>
              <div className="form-check form-check-inline custom-radio">
                <Form.Check 
                  type="radio" 
                  name="expectedEffect" 
                  value="NEGATIVE" 
                  label={<span className="text-danger fw-bold">Negative impact</span>}
                  id="effect-negative" 
                  className="fs-5"
                  defaultChecked 
                />
              </div>
            </div>
          </fieldset>
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-5 rounded-4 overflow-hidden">
        <div className="card-header bg-white border-bottom-0 pt-4 pb-0 px-4">
          <h3 className="h5 mb-0 text-primary fw-bold">What Happened</h3>
          <p className="text-muted small mt-1 mb-0">
            Supported: H1, H2, list, links, images and file attachments.
          </p>
        </div>
        <div className="card-body p-4">
          <EventEditor name="descriptionHtml" />
        </div>
      </div>

      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-3 bg-white p-4 shadow-sm border-0 rounded-4 mb-5">
        <Link href="/private/events" className="btn btn-light btn-lg px-4 text-secondary fw-bold">
          ← Back To Events
        </Link>
        <Button type="submit" variant="primary" size="lg" className="px-5 fw-bold shadow-sm">
          Save Important Day
        </Button>
      </div>
    </Form>
  );
}
