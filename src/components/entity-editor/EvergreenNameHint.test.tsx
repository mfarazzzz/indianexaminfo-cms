/**
 * EvergreenNameHint.test.tsx — the advisory shows on a dated name and is absent
 * (renders nothing) on an evergreen name. It is presentational: it takes a name
 * and needs no providers, so it is tested in isolation from GeneralTab.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { EvergreenNameHint } from "./EvergreenNameHint";

const MSG = "Put the year in the edition, not the name.";

describe("EvergreenNameHint", () => {
  it("advises when the name ends with a year", () => {
    render(<EvergreenNameHint name="IBPS PO 2025" />);
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(MSG);
  });

  it("renders nothing for an evergreen name (non-blocking, no noise)", () => {
    const { container } = render(<EvergreenNameHint name="NDA Exam" />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(MSG)).toBeNull();
  });

  it("renders nothing for an empty / null name", () => {
    const { container: c1 } = render(<EvergreenNameHint name="" />);
    const { container: c2 } = render(<EvergreenNameHint name={null} />);
    expect(c1).toBeEmptyDOMElement();
    expect(c2).toBeEmptyDOMElement();
  });
});
