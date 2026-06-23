import {
  Statemachine,
  StatefulStatusChanger,
  TransitionLogger,
  type ProcessInterface,
  type StatemachineInterface,
  type StatefulInterface,
  type LoggerInterface,
} from '@camcima/finita';
import { OrderAuditObserver } from './observer/OrderAuditObserver.js';

/** A minimal console logger satisfying finita's LoggerInterface. */
const consoleLogger: LoggerInterface = {
  log(level, message) {
    console.log(`  [${level}] ${message}`);
  },
};

/**
 * Domain object driven by a Statemachine.
 *
 * Implements StatefulInterface so a StatefulStatusChanger can keep a
 * denormalized `currentStateName` in sync on every committed transition — this
 * is the field you would persist (e.g. an `order.status` column).
 */
export class Order implements StatefulInterface {
  private readonly number: string;
  private readonly statemachine: StatemachineInterface<Order>;
  private currentStateName: string;

  constructor(number: string, process: ProcessInterface) {
    this.number = number;
    this.statemachine = new Statemachine<Order>(this, process, {
      // Bounds runaway automatic-transition loops (default is 100). Shown to
      // document the option; this example never loops.
      maxAutomaticHops: 50,
    });
    // Seed the denormalized status from the initial state; the
    // StatefulStatusChanger keeps it current from here on.
    this.currentStateName = this.statemachine.getCurrentState().getName();

    // v4 after-transition observers (typed; no casts needed):
    //  - StatefulStatusChanger writes frame.toState into frame.subject
    //    (this Order) via setCurrentStateName.
    //  - TransitionLogger logs every committed transition.
    //  - OrderAuditObserver records an audit trail using the typed frame.
    this.statemachine.attachAfter(new StatefulStatusChanger<Order>());
    this.statemachine.attachAfter(new TransitionLogger<Order>(consoleLogger));
    this.statemachine.attachAfter(new OrderAuditObserver());
  }

  async triggerEvent(name: string, context?: Map<string, unknown>): Promise<void> {
    await this.statemachine.triggerEvent(name, context);
  }

  hasEvent(name: string): boolean {
    return this.statemachine.getCurrentState().hasEvent(name);
  }

  getEventNames(): string[] {
    return this.statemachine.getCurrentState().getEventNames();
  }

  // --- StatefulInterface: the denormalized status the observer keeps in sync ---

  getCurrentStateName(): string {
    return this.currentStateName;
  }

  setCurrentStateName(stateName: string): void {
    this.currentStateName = stateName;
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
