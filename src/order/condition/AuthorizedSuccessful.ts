import type { ConditionInterface } from '@camcima/finita';

export class AuthorizedSuccessful implements ConditionInterface {
  checkCondition(_subject: unknown, context: Map<string, unknown>): boolean {
    return context.get('authorize result') === 'successful';
  }

  getName(): string {
    return 'authorized successful';
  }
}
