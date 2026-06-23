import type { Observer, ObservableSubject } from '@camcima/finita';
import { Order } from '../Order.js';

/**
 * Event observer (command) for the "authorize" event.
 *
 * Implemented as a named Observer (rather than a CallbackObserver) so the
 * command carries a stable name that appears in graph output (the "C:" label).
 *
 * An Observer.update receives the Event as `subject` and the invoke args as
 * `args` — for a Statemachine event those args are [orderSubject, context].
 * This command runs BEFORE the outgoing transitions are evaluated, so the
 * "authorize result" it writes into the context is visible to the conditions
 * that branch on it (AuthorizedSuccessful and its Not()).
 */
export class AuthorizeCommand implements Observer {
  getName(): string {
    return 'authorize-order';
  }

  update(_subject: ObservableSubject, args?: readonly unknown[]): void {
    const order = args?.[0] as Order;
    const context = args?.[1] as Map<string, unknown>;
    // PREPAYMENT 2 fails authorization to exercise the failure branch.
    const result = order.getNumber() === 'PREPAYMENT 2' ? 'failed' : 'successful';
    context.set('authorize result', result);
    console.log(`  [command] "authorize" on ${order.toString()} -> ${result}`);
  }
}
