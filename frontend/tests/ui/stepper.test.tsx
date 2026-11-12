import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Stepper, Step } from "../../src/ui/components/Stepper";

describe("Stepper (issue #149 D)", () => {
  it("renders steps in an ol/li structure, tracks active state with aria-current, and displays current step content", () => {
    render(
      <Stepper>
        <Step title="Account">
          <div>Step 1 Content</div>
        </Step>
        <Step title="Preferences">
          <div>Step 2 Content</div>
        </Step>
        <Step title="Security">
          <div>Step 3 Content</div>
        </Step>
      </Stepper>,
    );

    expect(screen.getByText("Step 1 Content")).toBeTruthy();
    expect(screen.queryByText("Step 2 Content")).toBeNull();

    const track = screen.getByRole("list", { name: "Setup progress" });
    expect(track).toBeTruthy();
    expect(track.tagName.toLowerCase()).toBe("ol");

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);

    const stepButtons = screen.getAllByRole("button", { name: /Step \d:/ });
    expect(stepButtons).toHaveLength(3);
    expect(stepButtons[0]?.getAttribute("aria-current")).toBe("step");
    expect(stepButtons[1]?.getAttribute("aria-current")).toBeNull();
    expect(stepButtons[2]?.getAttribute("aria-current")).toBeNull();
  });

  it("advances with Next, goes back with Back, and invokes onStepChange", async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();

    render(
      <Stepper onStepChange={onStepChange}>
        <Step title="One">
          <div>Content 1</div>
        </Step>
        <Step title="Two">
          <div>Content 2</div>
        </Step>
        <Step title="Three">
          <div>Content 3</div>
        </Step>
      </Stepper>,
    );

    const nextBtn = screen.getByRole("button", { name: "Continue" });

    // Click Next -> Step 2
    await user.click(nextBtn);
    expect(onStepChange).toHaveBeenCalledWith(2);
    expect(screen.getByText("Content 2")).toBeTruthy();

    const backBtn = screen.getByRole("button", { name: "Back" });
    expect(backBtn.style.visibility).toBe("visible");

    // Click Back -> Step 1
    await user.click(backBtn);
    expect(onStepChange).toHaveBeenCalledWith(1);
    expect(screen.getByText("Content 1")).toBeTruthy();
    expect(backBtn.style.visibility).toBe("hidden");
  });

  it("enforces linear mode: cannot jump ahead to unreached steps", async () => {
    const user = userEvent.setup();

    render(
      <Stepper linear>
        <Step title="Step 1">
          <div>Content 1</div>
        </Step>
        <Step title="Step 2">
          <div>Content 2</div>
        </Step>
        <Step title="Step 3">
          <div>Content 3</div>
        </Step>
      </Stepper>,
    );

    const stepButtons = screen.getAllByRole("button", {
      name: /Step \d:/,
    }) as HTMLButtonElement[];
    // Step 2 and Step 3 buttons should be disabled in linear mode when on step 1
    expect(stepButtons[1]?.disabled).toBe(true);
    expect(stepButtons[2]?.disabled).toBe(true);

    // Try clicking step 3 button
    await user.click(stepButtons[2]!);
    expect(screen.getByText("Content 1")).toBeTruthy();

    // Advance to step 2 via Next
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Content 2")).toBeTruthy();

    // Now step 1 is selectable (previously reached), step 3 is still disabled
    expect(stepButtons[0]?.disabled).toBe(false);
    expect(stepButtons[2]?.disabled).toBe(true);

    // Click step 1 button to go back
    await user.click(stepButtons[0]!);
    expect(screen.getByText("Content 1")).toBeTruthy();

    // Now step 2 is still selectable because it was previously reached
    expect(stepButtons[1]?.disabled).toBe(false);
    await user.click(stepButtons[1]!);
    expect(screen.getByText("Content 2")).toBeTruthy();
  });

  it("calls onFinalStepCompleted when Next is clicked on the final step", async () => {
    const user = userEvent.setup();
    const onFinalStepCompleted = vi.fn();

    render(
      <Stepper
        completeButtonText="Finish setup"
        onFinalStepCompleted={onFinalStepCompleted}
      >
        <Step title="Step 1">
          <div>Content 1</div>
        </Step>
        <Step title="Step 2">
          <div>Content 2</div>
        </Step>
      </Stepper>,
    );

    // Advance to step 2
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Content 2")).toBeTruthy();

    // On final step, button text updates to completeButtonText
    const finishBtn = screen.getByRole("button", { name: "Finish setup" });
    expect(finishBtn).toBeTruthy();

    await user.click(finishBtn);
    expect(onFinalStepCompleted).toHaveBeenCalledTimes(1);
  });

  it("moves focus to the first focusable element of the new pane when advancing", async () => {
    const user = userEvent.setup();

    render(
      <Stepper>
        <Step title="Step 1">
          <div>
            <input aria-label="First input" />
          </div>
        </Step>
        <Step title="Step 2">
          <div>
            <input aria-label="Second input" />
          </div>
        </Step>
      </Stepper>,
    );

    const firstInput = screen.getByLabelText("First input");
    firstInput.focus();
    expect(document.activeElement).toBe(firstInput);

    const continueBtn = screen.getByRole("button", { name: "Continue" });
    await user.click(continueBtn);

    const secondInput = screen.getByLabelText("Second input");
    expect(document.activeElement).toBe(secondInput);
  });

  it("moves focus to the pane itself if the new pane has no focusable elements", async () => {
    const user = userEvent.setup();

    render(
      <Stepper>
        <Step title="Step 1">
          <div>
            <input aria-label="Only input" />
          </div>
        </Step>
        <Step title="Step 2">
          <div data-testid="static-content">No inputs here</div>
        </Step>
      </Stepper>,
    );

    const onlyInput = screen.getByLabelText("Only input");
    onlyInput.focus();
    expect(document.activeElement).toBe(onlyInput);

    const continueBtn = screen.getByRole("button", { name: "Continue" });
    await user.click(continueBtn);

    const staticContent = screen.getByTestId("static-content");
    expect(document.activeElement).toBe(staticContent.parentElement);
  });
});
