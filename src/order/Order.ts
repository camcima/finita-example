import {
  Statemachine,
  type ProcessInterface,
  type StatemachineInterface,
} from 'finita';

export class Order {
  private readonly number: string;
  private readonly statemachine: StatemachineInterface;

  constructor(number: string, process: ProcessInterface) {
    this.number = number;
    this.statemachine = new Statemachine(this, process);
  }

  async triggerEvent(name: string, context?: Map<string, unknown>): Promise<void> {
    console.log(`trigger event "${name}" on ${this}`);
    await this.statemachine.triggerEvent(name, context);
  }

  hasEvent(name: string): boolean {
    return this.statemachine.getCurrentState().hasEvent(name);
  }

  getEventNames(): string[] {
    return this.statemachine.getCurrentState().getEventNames();
  }

  getCurrentStateName(): string {
    return this.statemachine.getCurrentState().getName();
  }

  getNumber(): string {
    return this.number;
  }

  getName(): string {
    return `Order ${this.number}`;
  }

  toString(): string {
    return `Order ${this.number}`;
  }
}
