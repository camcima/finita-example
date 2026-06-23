import { ProcessBuilder, Not, type Process } from '@camcima/finita';
import * as States from '../StateConstants.js';
import * as Events from '../EventConstants.js';
import * as Processes from '../ProcessConstants.js';
import { AuthorizedSuccessful } from '../condition/AuthorizedSuccessful.js';
import { ShippingDateGreater14Days } from '../condition/ShippingDateGreater14Days.js';
import { AuthorizeCommand } from '../command/Authorize.js';
import { ShippingCommand } from '../command/Shipping.js';
import type { Order } from '../Order.js';

/**
 * Prepayment workflow: orders are authorized before payment. Authorization can
 * succeed (-> payment pending) or fail (-> payment failed).
 *
 * v4: the whole graph is declared through the fluent, validated ProcessBuilder.
 * It returns a frozen, immutable Process. States and Transitions are no longer
 * user-constructible (no `new State()` / `new Transition()`).
 */
export function createPrepaymentProcess(): Process {
  const authorizeSuccessful = new AuthorizedSuccessful();
  const authorizeFailed = new Not(authorizeSuccessful);
  const shippingDateGreater14Days = new ShippingDateGreater14Days();

  const process = new ProcessBuilder<Order>(Processes.PROCESS_PREPAYMENT)
    .addState(States.STATE_NEW, { initial: true })
    .addState(States.STATE_PAYMENT_PENDING)
    .addState(States.STATE_PAYMENT_FAILED)
    .addState(States.STATE_SHIPPABLE)
    .addState(States.STATE_SHIPPED)
    .addState(States.STATE_CLOSED)
    .addState(States.STATE_RETURNED)
    .addState(States.STATE_RETURNED_AND_CLOSED)
    // Two transitions out of "new" on the same event, branching on the
    // condition. They share (from, event) but differ by target, so they are
    // distinct — not duplicates.
    .addTransition(States.STATE_NEW, States.STATE_PAYMENT_PENDING, {
      event: Events.EVENT_AUTHORIZE,
      condition: authorizeSuccessful,
    })
    .addTransition(States.STATE_NEW, States.STATE_PAYMENT_FAILED, {
      event: Events.EVENT_AUTHORIZE,
      condition: authorizeFailed,
    })
    .addTransition(States.STATE_PAYMENT_PENDING, States.STATE_SHIPPABLE, {
      event: Events.EVENT_PAID,
    })
    .addTransition(States.STATE_SHIPPABLE, States.STATE_SHIPPED, {
      event: Events.EVENT_SHIPPING,
    })
    // Automatic (eventless) transition: fires as soon as the condition holds.
    .addTransition(States.STATE_SHIPPED, States.STATE_CLOSED, {
      condition: shippingDateGreater14Days,
    })
    .addTransition(States.STATE_SHIPPED, States.STATE_RETURNED, {
      event: Events.EVENT_RETURNED,
    })
    .addTransition(States.STATE_CLOSED, States.STATE_RETURNED, {
      event: Events.EVENT_RETURNED,
    })
    .addTransition(States.STATE_RETURNED, States.STATE_RETURNED_AND_CLOSED, {
      event: Events.EVENT_REFUND,
    })
    .build();

  // v4: attach event observers (commands) after building. The Process is
  // frozen, but each State's Events still accept observers.
  process
    .getState(States.STATE_NEW)
    .getEvent(Events.EVENT_AUTHORIZE)
    .attach(new AuthorizeCommand());
  process
    .getState(States.STATE_SHIPPABLE)
    .getEvent(Events.EVENT_SHIPPING)
    .attach(new ShippingCommand());

  return process;
}
