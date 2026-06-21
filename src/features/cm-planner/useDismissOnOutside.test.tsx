import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { useDismissOnOutside } from './useDismissOnOutside';

afterEach(cleanup);

function Harness({ open, onClose, esc }: { open: boolean; onClose: () => void; esc?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismissOnOutside(ref, open, onClose, { esc });
  return (
    <div>
      <div ref={ref} data-testid="inside">inside</div>
      <div data-testid="outside">outside</div>
    </div>
  );
}

describe('useDismissOnOutside', () => {
  it('closes on a pointerdown outside the ref', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<Harness open onClose={onClose} />);
    fireEvent.pointerDown(getByTestId('outside'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close on a pointerdown inside the ref', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<Harness open onClose={onClose} />);
    fireEvent.pointerDown(getByTestId('inside'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('is a no-op while closed', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<Harness open={false} onClose={onClose} />);
    fireEvent.pointerDown(getByTestId('outside'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape only when esc is enabled', () => {
    const onCloseNoEsc = vi.fn();
    render(<Harness open onClose={onCloseNoEsc} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCloseNoEsc).not.toHaveBeenCalled();
    cleanup();

    const onCloseEsc = vi.fn();
    render(<Harness open esc onClose={onCloseEsc} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCloseEsc).toHaveBeenCalledTimes(1);
  });
});
