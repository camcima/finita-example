import type { ConditionInterface } from '@camcima/finita';
import type { Order } from '../Order.js';

export class AuthorizedSuccessful implements ConditionInterface<Order> {
  checkCondition(_subject: Order, context: Map<string, unknown>): boolean {
    return context.get('authorize result') === 'successful';
  }

  getName(): string {
    return 'authorized successful';
  }
}
