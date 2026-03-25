import {
  Process,
  State,
  Transition,
  CallbackObserver,
} from '@camcima/finita';
import * as States from '../StateConstants.js';
import * as Events from '../EventConstants.js';
import * as Processes from '../ProcessConstants.js';
import { ShippingDateGreater14Days } from '../condition/ShippingDateGreater14Days.js';
import { Order } from '../Order.js';

export function createPostpaymentProcess(): Process {
  const stateNew = new State(States.STATE_NEW);
  const shipped = new State(States.STATE_SHIPPED);
  const dunning = new State(States.STATE_DUNNING);
  const paid = new State(States.STATE_PAID);
  const closed = new State(States.STATE_CLOSED);
  const returned = new State(States.STATE_RETURNED);
  const returnedAndClosed = new State(States.STATE_RETURNED_AND_CLOSED);

  // Attach shipping command to the "shipping" event on "new" state
  const shippingEvent = stateNew.getEvent(Events.EVENT_SHIPPING);
  shippingEvent.attach(new CallbackObserver((subject: unknown) => {
    // Observer callbacks receive ObservableSubject, so a cast is still needed
    console.log(`Command: ${(subject as Order).toString()} is shipped!`);
  }));

  const shippingDateGreater14Days = new ShippingDateGreater14Days();

  stateNew.addTransition(new Transition(shipped, Events.EVENT_SHIPPING));
  shipped.addTransition(new Transition(dunning, null, shippingDateGreater14Days));
  shipped.addTransition(new Transition(paid, Events.EVENT_PAID));
  shipped.addTransition(new Transition(returnedAndClosed, Events.EVENT_RETURNED));
  dunning.addTransition(new Transition(returnedAndClosed, Events.EVENT_RETURNED));
  dunning.addTransition(new Transition(closed, Events.EVENT_PAID));
  paid.addTransition(new Transition(closed, null, shippingDateGreater14Days));
  paid.addTransition(new Transition(returned, Events.EVENT_RETURNED));
  closed.addTransition(new Transition(returned, Events.EVENT_RETURNED));
  returned.addTransition(new Transition(returnedAndClosed, Events.EVENT_REFUND));

  return new Process(Processes.PROCESS_POSTPAYMENT, stateNew);
}
