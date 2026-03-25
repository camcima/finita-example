import type { ConditionInterface } from '@camcima/finita';
import { Order } from '../Order.js';

export class ShippingDateGreater14Days implements ConditionInterface {
  checkCondition(subject: unknown, _context: Map<string, unknown>): boolean {
    if (!(subject instanceof Order)) {
      throw new Error('Subject has to be an Order!');
    }
    return subject.getNumber() === 'POSTPAYMENT 2';
  }

  getName(): string {
    return 'shipping-date >= 14 days';
  }
}
