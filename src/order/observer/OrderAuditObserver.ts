import type {
  AfterTransitionObserver,
  EnqueueContext,
  TransitionFrame,
} from '@camcima/finita';
import type { Order } from '../Order.js';

/**
 * A typed after-transition observer (v4 pattern).
 *
 * Unlike a CallbackObserver, an AfterTransitionObserver receives a typed
 * TransitionFrame. In v4 the frame carries `subject` (the machine's subject),
 * typed here as `Order` — so there are no casts. The frame also exposes the
 * from/to states, the triggering event, the guarding condition, the (readonly)
 * context, a timestamp, and the machine name.
 *
 * The `ctx` parameter is the EnqueueContext: an after-observer can enqueue a
 * follow-up event with `ctx.enqueue(name)` without re-entering the machine.
 * This observer only records an audit line, so it does not use it.
 */
export class OrderAuditObserver implements AfterTransitionObserver<Order> {
  notify(frame: TransitionFrame<Order>, _ctx: EnqueueContext): void {
    const order = frame.subject; // typed as Order — no cast
    const via = frame.event ? `event "${frame.event.getName()}"` : 'automatic';
    console.log(
      `  [audit] ${order.getName()}: ${frame.fromState.getName()} -> ` +
        `${frame.toState.getName()} (${via})`,
    );
  }
}
