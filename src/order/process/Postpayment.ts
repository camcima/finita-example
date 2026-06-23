import { ProcessBuilder, type Process } from '@camcima/finita';
import * as States from '../StateConstants.js';
import * as Events from '../EventConstants.js';
import * as Processes from '../ProcessConstants.js';
import { ShippingDateGreater14Days } from '../condition/ShippingDateGreater14Days.js';
import { ShippingCommand } from '../command/Shipping.js';
import type { Order } from '../Order.js';

/**
 * Postpayment workflow: orders ship immediately; payment is collected after
 * delivery. If shipping is older than 14 days an automatic transition moves the
 * order into dunning (or, once paid, closes it).
 */
export function createPostpaymentProcess(): Process {
  const shippingDateGreater14Days = new ShippingDateGreater14Days();

  const process = new ProcessBuilder<Order>(Processes.PROCESS_POSTPAYMENT)
    .addState(States.STATE_NEW, { initial: true })
    .addState(States.STATE_SHIPPED)
    .addState(States.STATE_DUNNING)
    .addState(States.STATE_PAID)
    .addState(States.STATE_CLOSED)
    .addState(States.STATE_RETURNED)
    .addState(States.STATE_RETURNED_AND_CLOSED)
    .addTransition(States.STATE_NEW, States.STATE_SHIPPED, {
      event: Events.EVENT_SHIPPING,
    })
    // Automatic: an unpaid order older than 14 days goes to dunning.
    .addTransition(States.STATE_SHIPPED, States.STATE_DUNNING, {
      condition: shippingDateGreater14Days,
    })
    .addTransition(States.STATE_SHIPPED, States.STATE_PAID, {
      event: Events.EVENT_PAID,
    })
    .addTransition(States.STATE_SHIPPED, States.STATE_RETURNED_AND_CLOSED, {
      event: Events.EVENT_RETURNED,
    })
    .addTransition(States.STATE_DUNNING, States.STATE_RETURNED_AND_CLOSED, {
      event: Events.EVENT_RETURNED,
    })
    .addTransition(States.STATE_DUNNING, States.STATE_CLOSED, {
      event: Events.EVENT_PAID,
    })
    // Automatic: a paid order older than 14 days closes.
    .addTransition(States.STATE_PAID, States.STATE_CLOSED, {
      condition: shippingDateGreater14Days,
    })
    .addTransition(States.STATE_PAID, States.STATE_RETURNED, {
      event: Events.EVENT_RETURNED,
    })
    .addTransition(States.STATE_CLOSED, States.STATE_RETURNED, {
      event: Events.EVENT_RETURNED,
    })
    .addTransition(States.STATE_RETURNED, States.STATE_RETURNED_AND_CLOSED, {
      event: Events.EVENT_REFUND,
    })
    .build();

  process
    .getState(States.STATE_NEW)
    .getEvent(Events.EVENT_SHIPPING)
    .attach(new ShippingCommand());

  return process;
}
