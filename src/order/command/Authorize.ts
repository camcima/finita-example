import { CallbackObserver } from 'finita';
import { Order } from '../Order.js';

export function createAuthorizeCommand(): CallbackObserver {
  return new CallbackObserver((subject: unknown, context: unknown) => {
    const order = subject as Order;
    const ctx = context as Map<string, unknown>;
    if (order.getNumber() !== 'PREPAYMENT 2') {
      ctx.set('authorize result', 'successful');
    } else {
      ctx.set('authorize result', 'failed');
    }
    console.log(`Command "Authorize" was executed. Result: ${ctx.get('authorize result')}`);
  });
}
