"use client";

import type React from "react";
import { AlertCircle, Check } from "lucide-react";

export type StepperStepStatus = "upcoming" | "active" | "completed" | "error";

export interface StepperStep {
  id: string;
  title: string;
  description?: string;
  status: StepperStepStatus;
  disabled?: boolean;
}

export interface StepperProps {
  steps: StepperStep[];
  orientation?: "vertical" | "horizontal";
  onStepClick?: (stepId: string, index: number) => void;
  ariaLabel?: string;
  className?: string;
}

export function Stepper({
  steps,
  orientation = "vertical",
  onStepClick,
  ariaLabel = "创作步骤",
  className,
}: StepperProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={["gl-stepper-nav", className ?? ""].filter(Boolean).join(" ")}
    >
      <ol className={`gl-stepper gl-stepper--${orientation}`}>
        {steps.map((step, index) => {
          const canClick =
            Boolean(onStepClick) &&
            !step.disabled &&
            (step.status === "completed" || step.status === "active");

          const indicator = (
            <span className="gl-stepper-circle" aria-hidden="true">
              {step.status === "completed" ? (
                <Check size={14} strokeWidth={2.4} />
              ) : step.status === "error" ? (
                <AlertCircle size={14} strokeWidth={2.2} />
              ) : (
                index + 1
              )}
            </span>
          );

          const textBlock = (
            <span className="gl-stepper-text">
              <span className="gl-stepper-title">{step.title}</span>
              {step.description && (
                <span className="gl-stepper-desc">{step.description}</span>
              )}
            </span>
          );

          return (
            <li
              key={step.id}
              className={[
                "gl-stepper-item",
                `is-${step.status}`,
                index < steps.length - 1 ? "has-connector" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {canClick ? (
                <button
                  type="button"
                  className="gl-stepper-trigger"
                  aria-current={step.status === "active" ? "step" : undefined}
                  onClick={() => onStepClick?.(step.id, index)}
                >
                  {indicator}
                  {textBlock}
                </button>
              ) : (
                <div
                  className="gl-stepper-trigger is-static"
                  aria-current={step.status === "active" ? "step" : undefined}
                >
                  {indicator}
                  {textBlock}
                </div>
              )}
              {index < steps.length - 1 && (
                <span className="gl-stepper-connector" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Stepper;
