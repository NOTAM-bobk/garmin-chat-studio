import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// NumberFlow needs a real layout engine; a plain span is enough here.
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value.toFixed(2)}</span>,
}));

import { PricingInteraction } from "@/components/ui/pricing-interaction";

describe("PricingInteraction", () => {
  it("offers Free and Starter with Starter selected", () => {
    render(<PricingInteraction starterMonth={9.99} starterAnnual={7.49} />);

    expect(screen.getByRole("radio", { name: /Free/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: /Starter/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Popular")).toBeInTheDocument();
  });

  it("reports the chosen plan and billing period", () => {
    const onStart = vi.fn();
    render(<PricingInteraction starterMonth={9.99} starterAnnual={7.49} onStart={onStart} />);

    fireEvent.click(screen.getByRole("button", { name: "Yearly" }));
    fireEvent.click(screen.getByRole("button", { name: "Get Started" }));
    expect(onStart).toHaveBeenLastCalledWith("starter", "year");

    fireEvent.click(screen.getByRole("radio", { name: /Free/ }));
    fireEvent.click(screen.getByRole("button", { name: "Get Started" }));
    expect(onStart).toHaveBeenLastCalledWith("free", "year");
  });

  it("shows the yearly saving", () => {
    render(<PricingInteraction starterMonth={9.99} starterAnnual={7.49} />);

    fireEvent.click(screen.getByRole("button", { name: "Yearly" }));
    expect(screen.getByText(/Billed yearly/)).toBeInTheDocument();
  });
});
