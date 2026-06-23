import type { Observer, ObservableSubject } from '@camcima/finita';
import { Order } from '../Order.js';

/**
 * Event observer (command) for the "shipping" event — a named Observer so it
 * shows up by name in graph output (the "C:" label).
 *
 * The shipped Order arrives as the first invoke arg (`args[0]`); `subject` is
 * the Event itself. (For a quick inline command without a name, the library's
 * CallbackObserver spreads the invoke args straight into a callback.)
 */
export class ShippingCommand implements Observer {
  getName(): string {
    return 'ship-order';
  }

  update(_subject: ObservableSubject, args?: readonly unknown[]): void {
    const order = args?.[0] as Order;
    console.log(`  [command] ${order.toString()} is shipped!`);
  }
}
