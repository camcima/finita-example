import {
  Process,
  State,
  Transition,
  CallbackObserver,
  Not,
} from '@camcima/finita';
import * as States from '../StateConstants.js';
import * as Events from '../EventConstants.js';
import * as Processes from '../ProcessConstants.js';
import { AuthorizedSuccessful } from '../condition/AuthorizedSuccessful.js';
import { ShippingDateGreater14Days } from '../condition/ShippingDateGreater14Days.js';
import { createAuthorizeCommand } from '../command/Authorize.js';
import { Order } from '../Order.js';

export function createPrepaymentProcess(): Process {
  const stateNew = new State(States.STATE_NEW);
  const paymentFailed = new State(States.STATE_PAYMENT_FAILED);
  const paymentPending = new State(States.STATE_PAYMENT_PENDING);
  const shippable = new State(States.STATE_SHIPPABLE);
  const shipped = new State(States.STATE_SHIPPED);
  const closed = new State(States.STATE_CLOSED);
  const returned = new State(States.STATE_RETURNED);
  const returnedAndClosed = new State(States.STATE_RETURNED_AND_CLOSED);

  // Attach authorize command to the "authorize" event on "new" state
  const authorizeEvent = stateNew.getEvent(Events.EVENT_AUTHORIZE);
  authorizeEvent.attach(createAuthorizeCommand());

  // Attach shipping command to the "shipping" event on "shippable" state
  const shippingEvent = shippable.getEvent(Events.EVENT_SHIPPING);
  shippingEvent.attach(new CallbackObserver((subject: unknown) => {
    const order = subject as Order;
    console.log(`Command: ${order.toString()} is shipped!`);
  }));

  const shippingDateGreater14Days = new ShippingDateGreater14Days();
  const authorizeSuccessful = new AuthorizedSuccessful();
  const authorizeFailed = new Not(authorizeSuccessful);

  stateNew.addTransition(new Transition(paymentFailed, Events.EVENT_AUTHORIZE, authorizeFailed));
  stateNew.addTransition(new Transition(paymentPending, Events.EVENT_AUTHORIZE, authorizeSuccessful));
  paymentPending.addTransition(new Transition(shippable, Events.EVENT_PAID));
  shippable.addTransition(new Transition(shipped, Events.EVENT_SHIPPING));
  shipped.addTransition(new Transition(closed, null, shippingDateGreater14Days));
  shipped.addTransition(new Transition(returned, Events.EVENT_RETURNED));
  closed.addTransition(new Transition(returned, Events.EVENT_RETURNED));
  returned.addTransition(new Transition(returnedAndClosed, Events.EVENT_REFUND));

  return new Process(Processes.PROCESS_PREPAYMENT, stateNew);
}
