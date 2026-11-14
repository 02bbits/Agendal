import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSortableList } from "../../src/ui/features/shell/useSortableList";

function TestList({
  initialOrder = ["a", "b", "c", "d"],
  onCommit,
}: {
  initialOrder?: string[];
  onCommit: (next: string[]) => void;
}) {
  const { displayOrder, draggingId, getItemProps, getHandleProps } =
    useSortableList(initialOrder, onCommit);

  return (
    <ul data-testid="list">
      {displayOrder.map((id) => (
        <li
          key={id}
          {...getItemProps(id)}
          data-testid={`item-${id}`}
          data-dragging={draggingId === id ? "true" : "false"}
        >
          <span>{id}</span>
          <button
            type="button"
            data-testid={`handle-${id}`}
            {...getHandleProps(id)}
          >
            drag
          </button>
        </li>
      ))}
    </ul>
  );
}

function mockRects(height = 50) {
  const rectMap: Record<string, DOMRect> = {
    a: {
      top: 0,
      bottom: 50,
      height,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    },
    b: {
      top: 50,
      bottom: 100,
      height,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: 50,
      toJSON: () => {},
    },
    c: {
      top: 100,
      bottom: 150,
      height,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: 100,
      toJSON: () => {},
    },
    d: {
      top: 150,
      bottom: 200,
      height,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: 150,
      toJSON: () => {},
    },
  };

  const originalGetBoundingClientRect =
    HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function () {
    const sortableId = this.getAttribute("data-sortable-id");
    if (sortableId && rectMap[sortableId]) {
      return rectMap[sortableId];
    }
    return originalGetBoundingClientRect.call(this);
  };

  return () => {
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  };
}

function createPointerEvent(type: string, props: Record<string, unknown> = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    button: 0,
    pointerId: 1,
    ...props,
  });
  return event;
}

describe("useSortableList hook (issue #149 E)", () => {
  it("drags down two rows and drags up", () => {
    const restore = mockRects();
    const onCommit = vi.fn();
    render(<TestList onCommit={onCommit} />);

    const handleA = screen.getByTestId("handle-a");

    // Pointer down on A
    fireEvent(handleA, createPointerEvent("pointerdown", { clientY: 25 }));
    expect(screen.getByTestId("item-a").getAttribute("data-dragging")).toBe(
      "true",
    );

    // Drag down past b (midpoint 75) and past c (midpoint 125)
    fireEvent(window, createPointerEvent("pointermove", { clientY: 130 }));

    let items = screen
      .getAllByRole("listitem")
      .map((el) => el.textContent?.replace("drag", ""));
    expect(items).toEqual(["b", "c", "a", "d"]);

    // Drag up back to top
    fireEvent(window, createPointerEvent("pointermove", { clientY: 20 }));
    items = screen
      .getAllByRole("listitem")
      .map((el) => el.textContent?.replace("drag", ""));
    expect(items).toEqual(["a", "b", "c", "d"]);

    restore();
  });

  it("cancels drag with Escape and restores original order without calling onCommit", () => {
    const restore = mockRects();
    const onCommit = vi.fn();
    render(<TestList onCommit={onCommit} />);

    const handleA = screen.getByTestId("handle-a");

    fireEvent(handleA, createPointerEvent("pointerdown", { clientY: 25 }));
    fireEvent(window, createPointerEvent("pointermove", { clientY: 130 }));

    let items = screen
      .getAllByRole("listitem")
      .map((el) => el.textContent?.replace("drag", ""));
    expect(items).toEqual(["b", "c", "a", "d"]);

    // Press Escape to cancel
    fireEvent.keyDown(window, { key: "Escape" });

    items = screen
      .getAllByRole("listitem")
      .map((el) => el.textContent?.replace("drag", ""));
    expect(items).toEqual(["a", "b", "c", "d"]);
    expect(onCommit).not.toHaveBeenCalled();

    restore();
  });

  it("commits new order on pointer up and calls onCommit once", () => {
    const restore = mockRects();
    const onCommit = vi.fn();
    render(<TestList onCommit={onCommit} />);

    const handleA = screen.getByTestId("handle-a");

    fireEvent(handleA, createPointerEvent("pointerdown", { clientY: 25 }));
    fireEvent(window, createPointerEvent("pointermove", { clientY: 85 })); // past b midpoint (75)

    const items = screen
      .getAllByRole("listitem")
      .map((el) => el.textContent?.replace("drag", ""));
    expect(items).toEqual(["b", "a", "c", "d"]);

    fireEvent(window, createPointerEvent("pointerup", { clientY: 85 }));

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(["b", "a", "c", "d"]);

    restore();
  });
});
