import { TestBed } from '@angular/core/testing';
import { Stars } from './stars';

describe('Stars', () => {
  function render(value: number | null, count: number | null = null) {
    const fixture = TestBed.createComponent(Stars);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('count', count);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const top = host.querySelector('[aria-hidden="true"]')!;
    // Each star is a direct child: a full/empty star span, or a half-star wrapper.
    const fills = Array.from(top.children).map((el) =>
      el.classList.contains('relative')
        ? 'half'
        : el.classList.contains('text-amber-400')
          ? 'full'
          : 'empty',
    );
    return { fills, label: host.querySelector('[role="img"]')!.getAttribute('aria-label') };
  }

  it('rounds to the nearest half star instead of overstating', () => {
    expect(render(4.5).fills).toEqual(['full', 'full', 'full', 'full', 'half']);
    expect(render(4.2).fills).toEqual(['full', 'full', 'full', 'full', 'empty']);
    expect(render(4.8).fills).toEqual(['full', 'full', 'full', 'full', 'full']);
    expect(render(3).fills).toEqual(['full', 'full', 'full', 'empty', 'empty']);
  });

  it('describes the rating for screen readers', () => {
    expect(render(4.5, 2).label).toBe('Rated 4.5 out of 5 from 2 reviews');
    expect(render(5, 1).label).toBe('Rated 5.0 out of 5 from 1 review');
    expect(render(null).label).toBe('No reviews yet');
  });
});
