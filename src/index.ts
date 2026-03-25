import type { ProcessInterface } from '@camcima/finita';
import { Order } from './order/Order.js';
import { createPrepaymentProcess } from './order/process/Prepayment.js';
import { createPostpaymentProcess } from './order/process/Postpayment.js';
import * as Events from './order/EventConstants.js';

const processes = new Map<string, ProcessInterface>();
const prepayment = createPrepaymentProcess();
const postpayment = createPostpaymentProcess();
processes.set(prepayment.getName(), prepayment);
processes.set(postpayment.getName(), postpayment);

const orders = new Map<string, Order>();
orders.set('PREPAYMENT 1', new Order('PREPAYMENT 1', processes.get('prepayment')!));
orders.set('PREPAYMENT 2', new Order('PREPAYMENT 2', processes.get('prepayment')!));
orders.set('POSTPAYMENT 1', new Order('POSTPAYMENT 1', processes.get('postpayment')!));
orders.set('POSTPAYMENT 2', new Order('POSTPAYMENT 2', processes.get('postpayment')!));

console.log('=============================================================');
console.log('all created orders have the status "new"');
console.log('=============================================================');
for (const order of orders.values()) {
  console.log(`${order.toString()} has status ${order.getCurrentStateName()}`);
  console.log(`possible events: ${order.getEventNames().join(', ')}`);
  console.log('-------------------------------------------------------------');
}

console.log('=============================================================');
console.log('now we are authorizing all orders if possible');
console.log('=============================================================');
for (const order of orders.values()) {
  console.log(`${order.toString()} has status ${order.getCurrentStateName()}`);
  if (order.hasEvent(Events.EVENT_AUTHORIZE)) {
    await order.triggerEvent(Events.EVENT_AUTHORIZE);
    console.log(`${order.toString()} has status ${order.getCurrentStateName()}`);
  }

  if (order.hasEvent(Events.EVENT_PAID)) {
    await order.triggerEvent(Events.EVENT_PAID);
    console.log(`${order.toString()} has status ${order.getCurrentStateName()}`);
  }

  console.log('-------------------------------------------------------------');
}

console.log('=============================================================');
console.log('now we are shipping all orders if possible');
console.log('=============================================================');
for (const order of orders.values()) {
  console.log(`${order.toString()} has status ${order.getCurrentStateName()}`);
  if (order.hasEvent(Events.EVENT_SHIPPING)) {
    await order.triggerEvent(Events.EVENT_SHIPPING);
    console.log(`${order.toString()} has status ${order.getCurrentStateName()}`);
  }

  console.log('-------------------------------------------------------------');
}

console.log('=============================================================');
console.log('now all orders will be returned');
console.log('=============================================================');
for (const order of orders.values()) {
  console.log(`${order.toString()} has status ${order.getCurrentStateName()}`);
  try {
    await order.triggerEvent(Events.EVENT_RETURNED);
  } catch (e) {
    const error = e as Error;
    console.log(
      `Triggering the event "${Events.EVENT_RETURNED}" on order "${order.toString()}" throws an error: ${error.message}`,
    );
  }
  console.log(`${order.toString()} has status ${order.getCurrentStateName()}`);
  console.log('-------------------------------------------------------------');
}
