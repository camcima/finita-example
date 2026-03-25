import type { ConditionInterface } from '@camcima/finita';
import { Order } from '../Order.js';

export class ShippingDateGreater14Days implements ConditionInterface<Order> {
  checkCondition(subject: Order, _context: Map<string, unknown>): boolean {
    return subject.getNumber() === 'POSTPAYMENT 2';
  }

  getName(): string {
    return 'shipping-date >= 14 days';
  }
}
