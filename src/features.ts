/**
 * Spotlight on finita v4 features, up to v4.3.
 *
 * Run with: `npm run features`
 *
 * The order-processing demo (`npm start`) already showcases ProcessBuilder,
 * typed observers, StatefulStatusChanger, TransitionLogger, frame.subject, and
 * automatic transitions. This file isolates the remaining headline features.
 * Each section notes the release that introduced or changed what it shows.
 */
import {
  ProcessBuilder,
  Statemachine,
  Factory,
  SingleProcessDetector,
  StatefulStateNameDetector,
  StatefulStatusChanger,
  LockAdapterMutex,
  MutexFactory,
  CallbackCondition,
  AndComposite,
  Tautology,
  Not,
  WeightTransition,
  OnEnterObserver,
  ReentrancyError,
  AutomaticTransitionCycleError,
  AmbiguousTransitionError,
  QueueLimitExceededError,
  LockOwnershipUncertainError,
  type EnqueueContext,
  type LockAdapterInterface,
  type StatefulInterface,
  type TransitionFrame,
} from '@camcima/finita';

function banner(title: string): void {
  console.log('\n' + '='.repeat(61));
  console.log(title);
  console.log('='.repeat(61));
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Summarizes a settled promise. Typed finita errors are shown by class name;
 * a plain Error is shown by its message.
 */
function outcome(result: PromiseSettledResult<unknown>): string {
  if (result.status === 'fulfilled') return 'fulfilled';
  const error = result.reason as Error;
  return `rejected: ${error.name === 'Error' ? error.message : error.name}`;
}

/**
 * An in-memory stand-in for a shared lock service such as Redis. Real
 * adapters implement the same three methods against the real service.
 */
function inMemoryLockService(): LockAdapterInterface & {
  failNextRelease: boolean;
} {
  const held = new Set<string>();
  return {
    failNextRelease: false,
    async acquireLock(resource) {
      if (held.has(resource)) return false;
      held.add(resource);
      return true;
    },
    async releaseLock(resource) {
      if (this.failNextRelease) {
        this.failNextRelease = false;
        // The request never reached the service, so the lock is still held.
        throw new Error('connection reset before unlock');
      }
      return held.delete(resource);
    },
    async isLocked(resource) {
      return held.has(resource);
    },
  };
}

// ---------------------------------------------------------------------------
// 1. Composite conditions (AND / NOT) with a typed subject
// ---------------------------------------------------------------------------
banner('1. Composite conditions (AND / NOT) with a typed subject');

interface Account {
  balance: number;
  verified: boolean;
}

const hasFunds = new CallbackCondition<Account>(
  'hasFunds',
  (account) => account.balance >= 100,
);
const isVerified = new CallbackCondition<Account>(
  'isVerified',
  (account) => account.verified,
);
// AND: chain extra conditions with addAnd(); NOT wraps a single condition.
const canWithdraw = new AndComposite<Account>(hasFunds).addAnd(isVerified);
const isUnverified = new Not<Account>(isVerified);

const accountProcess = new ProcessBuilder<Account>('account')
  .addState('open', { initial: true })
  .addState('withdrawn')
  .addState('flagged')
  .addTransition('open', 'withdrawn', {
    event: 'withdraw',
    condition: canWithdraw,
  })
  .addTransition('open', 'flagged', { event: 'withdraw', condition: isUnverified })
  .build();

console.log(`withdraw guard: ${canWithdraw.getName()}`);
for (const account of [
  { balance: 150, verified: true },
  { balance: 150, verified: false },
  { balance: 50, verified: true },
]) {
  const sm = new Statemachine<Account>(account, accountProcess);
  await sm.triggerEvent('withdraw');
  console.log(
    `  balance=${account.balance} verified=${account.verified} -> ${sm.getCurrentState().getName()}`,
  );
}

// ---------------------------------------------------------------------------
// 2. ReentrancyError — re-entering the machine from a callback is rejected
// ---------------------------------------------------------------------------
banner('2. ReentrancyError — re-entering the machine from a callback');

const reentrantProcess = new ProcessBuilder('reentrant')
  .addState('a', { initial: true })
  .addState('b')
  .addState('c')
  .addTransition('a', 'b', { event: 'go' })
  .addTransition('b', 'c', { event: 'next' })
  .build();

const sm2 = new Statemachine({}, reentrantProcess);
sm2.attachAfter({
  async notify(): Promise<void> {
    // Re-entering the SAME machine here would deadlock — v4 rejects instead.
    await sm2.triggerEvent('next');
  },
});

try {
  await sm2.triggerEvent('go');
} catch (err) {
  console.log(`  from an observer: ${(err as Error).message}`);
  console.log(`  instanceof ReentrancyError: ${err instanceof ReentrancyError}`);
  console.log(`  machine still usable, current state: ${sm2.getCurrentState().getName()}`);
}

// v4.3: the check also reaches conditions nested inside composites. Before
// v4.3, a composite awaited each child, so a re-entrant call from any child
// after the first hung the machine forever instead of throwing.
const guarded: { sm?: Statemachine } = {};
const peeksAtMachine = new CallbackCondition('peeksAtMachine', () =>
  guarded.sm!.checkTransitions().then(() => true),
);
const compositeProcess = new ProcessBuilder('composite-reentrant')
  .addState('a', { initial: true })
  .addState('b')
  .addTransition('a', 'b', {
    event: 'go',
    condition: new AndComposite(new Tautology()).addAnd(peeksAtMachine),
  })
  .build();
guarded.sm = new Statemachine({}, compositeProcess);

try {
  await guarded.sm.triggerEvent('go');
} catch (err) {
  console.log(
    `  from the 2nd child of an AndComposite: ${err instanceof ReentrancyError ? 'ReentrancyError' : String(err)}`,
  );
}

// ---------------------------------------------------------------------------
// 3. maxAutomaticHops — bounding a runaway automatic-transition loop
// ---------------------------------------------------------------------------
banner('3. maxAutomaticHops — bounding a runaway automatic loop');

const always = new Tautology();
const loopProcess = new ProcessBuilder('loop')
  .addState('ping', { initial: true })
  .addState('pong')
  // Two eventless transitions that are always active => infinite ping-pong.
  .addTransition('ping', 'pong', { condition: always })
  .addTransition('pong', 'ping', { condition: always })
  .build();

const sm3 = new Statemachine({}, loopProcess, { maxAutomaticHops: 10 });
try {
  await sm3.checkTransitions(); // kick the automatic loop
} catch (err) {
  if (err instanceof AutomaticTransitionCycleError) {
    console.log(`  caught AutomaticTransitionCycleError`);
    console.log(`  hop limit: ${err.hopLimit}, last target: "${err.stateName}"`);
  } else {
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 4. Ambiguous transitions — diagnosing them, then resolving them by weight
// ---------------------------------------------------------------------------
banner('4. Ambiguous transitions and the WeightTransition selector');

const weightedProcess = new ProcessBuilder('weighted')
  .addState('start', { initial: true })
  .addState('low')
  .addState('high')
  // Both are active on "go".
  .addTransition('start', 'low', { event: 'go', condition: always, weight: 1 })
  .addTransition('start', 'high', { event: 'go', condition: always, weight: 5 })
  .build();

// v4.2: the default selector's AmbiguousTransitionError lists the competing
// transitions, so the culprits are identifiable without a debugger.
try {
  await new Statemachine({}, weightedProcess).triggerEvent('go');
} catch (err) {
  if (!(err instanceof AmbiguousTransitionError)) throw err;
  console.log(`  default selector: AmbiguousTransitionError, candidates:`);
  for (const c of err.candidates) {
    console.log(`    -> "${c.targetStateName}" (condition ${c.conditionName}, weight ${c.weight})`);
  }
}

const sm4 = new Statemachine({}, weightedProcess, {
  transitionSelector: new WeightTransition(),
});
await sm4.triggerEvent('go');
console.log(`  WeightTransition selects (weight 5 wins): ${sm4.getCurrentState().getName()}`);

// ---------------------------------------------------------------------------
// 5. OnEnterObserver — auto-firing a chained event on state entry
// ---------------------------------------------------------------------------
banner('5. OnEnterObserver — chained event via EnqueueContext');

const onEnterProcess = new ProcessBuilder('onEnter')
  .addState('draft', { initial: true })
  .addState('review')
  .addState('approved')
  .addTransition('draft', 'review', { event: 'submit' })
  // Entering "review" enqueues an "onEnter" event that advances to "approved".
  .addTransition('review', 'approved', { event: 'onEnter' })
  .build();

const sm5 = new Statemachine({}, onEnterProcess);
sm5.attachAfter(new OnEnterObserver());

await sm5.triggerEvent('submit');
console.log(`  right after "submit": ${sm5.getCurrentState().getName()}`);
// v4.1: the chained onEnter runs as its own queued operation. whenIdle()
// resolves once the queue has fully drained, chained operations included.
await sm5.whenIdle();
console.log(`  after whenIdle(), auto-advanced to: ${sm5.getCurrentState().getName()}`);

// ---------------------------------------------------------------------------
// 6. Chained-operation errors and back-pressure
// ---------------------------------------------------------------------------
banner('6. Chained-operation errors and back-pressure');

const pipelineProcess = new ProcessBuilder('pipeline')
  .addState('received', { initial: true })
  .addState('processed')
  .addTransition('received', 'processed', { event: 'process' })
  .build();

const sm6 = new Statemachine({}, pipelineProcess, {
  // v4.1: at most 2 operations may wait behind the running one.
  maxQueueLength: 2,
  // v4.1: chained operations have no caller to reject, so their failures
  // arrive here. v4.3: the hook may be async, and even a rejection from it
  // (here, an unreachable telemetry backend) is contained rather than
  // crashing Node as an unhandled rejection.
  onChainedOperationError: async (error, info) => {
    console.log(`  [sink] chained "${info.eventName}" failed: ${(error as Error).name}`);
    throw new Error('telemetry backend unavailable');
  },
});
sm6.attachAfter({
  notify(_frame: TransitionFrame, ctx: EnqueueContext): void {
    // "processed" declares no "archive" event, so this chained op fails.
    ctx.enqueue('archive');
  },
});

await sm6.triggerEvent('process');
await sm6.whenIdle();
console.log(`  caller unaffected, state: ${sm6.getCurrentState().getName()}`);

// Fire 5 operations at once: 1 runs, 2 wait, and the last 2 are refused.
const burst = await Promise.allSettled(
  Array.from({ length: 5 }, () => sm6.checkTransitions()),
);
const refused = burst.filter(
  (r) => r.status === 'rejected' && r.reason instanceof QueueLimitExceededError,
).length;
console.log(`  burst of 5: ${5 - refused} accepted, ${refused} refused with QueueLimitExceededError`);

// ---------------------------------------------------------------------------
// 7. Lock release failures — LockOwnershipUncertainError
// ---------------------------------------------------------------------------
banner('7. Lock release failures and uncertain ownership');

const ticketProcess = new ProcessBuilder('ticket')
  .addState('new', { initial: true })
  .addState('opened')
  .addState('closed')
  .addTransition('new', 'opened', { event: 'open' })
  .addTransition('opened', 'closed', { event: 'close' })
  .build();

const ticketLocks = inMemoryLockService();
const sm7 = new Statemachine({}, ticketProcess, {
  mutex: new LockAdapterMutex(ticketLocks, 'ticket:42'),
  onReleaseError: (error) =>
    console.log(`  [onReleaseError] ${(error as Error).message}`),
});

ticketLocks.failNextRelease = true;
// "open" commits, but releasing its lock fails. "close" is already queued.
const [opened, closed] = await Promise.allSettled([
  sm7.triggerEvent('open'),
  sm7.triggerEvent('close'),
]);
console.log(`  "open":  ${outcome(opened)}`);
console.log(`  "close": ${outcome(closed)}`);
if (closed.status === 'rejected' && closed.reason instanceof LockOwnershipUncertainError) {
  // The error's cause is the release failure that made ownership unclear.
  console.log(`  its cause: ${(closed.reason.cause as Error).message}`);
}
// v4.3: before this, "close" skipped acquisition and ran on the stale
// "acquired" flag. If the unlock had in fact happened remotely, another
// worker could have held the lock at the same time.
console.log(`  state stays: ${sm7.getCurrentState().getName()}`);

// Recovery: a manual release that succeeds re-establishes ownership. If it
// cannot succeed (the first unlock did happen and only its reply was lost),
// discard the machine and rebuild it from persisted state instead.
await sm7.releaseLock();
console.log(`  after a successful releaseLock(), lock held: ${sm7.isLockAcquired()}`);
await sm7.triggerEvent('close');
console.log(`  "close" now runs, state: ${sm7.getCurrentState().getName()}`);

// ---------------------------------------------------------------------------
// 8. Factory engine options, and locks with persisted state
// ---------------------------------------------------------------------------
banner('8. Factory engine options, and locks with persisted state');

class Invoice implements StatefulInterface {
  constructor(
    readonly id: string,
    private state: string,
  ) {}
  getCurrentStateName(): string {
    return this.state;
  }
  setCurrentStateName(name: string): void {
    this.state = name;
  }
}

// A stand-in for a database table: every load returns a fresh copy.
const invoiceTable = new Map<string, string>();
const loadInvoice = (id: string): Invoice => new Invoice(id, invoiceTable.get(id)!);
const saveInvoice = (invoice: Invoice): void => {
  invoiceTable.set(invoice.id, invoice.getCurrentStateName());
};

const invoiceProcess = new ProcessBuilder<Invoice>('invoice')
  .addState('draft', { initial: true })
  .addState('approved')
  .addTransition('draft', 'approved', { event: 'approve' })
  .build();

const invoiceLocks = inMemoryLockService();
let emailsSent = 0;

function invoiceFactory(withMachineLock: boolean): Factory<Invoice> {
  // v4.2: engine options passed here apply to every machine the factory
  // creates. Before v4.2, factory-built machines always ran on defaults.
  const factory = new Factory<Invoice>(
    new SingleProcessDetector(invoiceProcess),
    new StatefulStateNameDetector(), // start each machine from invoice state
    {
      maxQueueLength: 10,
      onReleaseError: (error) => console.error('lock release failed', error),
    },
  );
  if (withMachineLock) {
    factory.setMutexFactory(
      new MutexFactory<Invoice>(invoiceLocks, (invoice) => `invoice:${invoice.id}`),
    );
  }
  factory.attachAfterObserver(new StatefulStatusChanger<Invoice>());
  factory.attachAfterObserver({
    notify: (frame: TransitionFrame<Invoice>) => {
      emailsSent++;
      console.log(`    [email] invoice ${frame.subject.id} approved`);
    },
  });
  return factory;
}

// Pitfall: a lock serializes execution but does not refresh a machine's
// state. Two workers that build machines from the same snapshot both start
// in "draft", take the lock in turn, and both approve.
invoiceTable.set('INV-1', 'draft');
const lockedFactory = invoiceFactory(true);
const workerA = await lockedFactory.createStatemachine(loadInvoice('INV-1'));
const workerB = await lockedFactory.createStatemachine(loadInvoice('INV-1'));
console.log('  machines built before taking the lock:');
await workerA.triggerEvent('approve');
await workerB.triggerEvent('approve');
console.log(`  emails sent: ${emailsSent} (the approval ran twice)`);

// Pattern (v4.3 docs, "Locks and persisted state"): take the lock, load
// inside it, build the machine, trigger, persist, then release. The
// application holds the lock, so the machine needs no mutex of its own.
emailsSent = 0;
invoiceTable.set('INV-2', 'draft');
const plainFactory = invoiceFactory(false);

async function approveInvoice(id: string): Promise<void> {
  const resource = `invoice:${id}`;
  while (!(await invoiceLocks.acquireLock(resource))) {
    await delay(5); // busy: another worker holds the lock
  }
  try {
    const invoice = loadInvoice(id); // fresh, inside the lock
    const sm = await plainFactory.createStatemachine(invoice);
    await sm.triggerEvent('approve');
    saveInvoice(invoice);
  } finally {
    await invoiceLocks.releaseLock(resource);
  }
}

console.log('  loading inside the lock:');
const [first, second] = await Promise.allSettled([
  approveInvoice('INV-2'),
  approveInvoice('INV-2'),
]);
console.log(`  worker 1: ${outcome(first)}`);
console.log(`  worker 2: ${outcome(second)}, it loaded the approved invoice`);
console.log(`  emails sent: ${emailsSent}, stored state: ${invoiceTable.get('INV-2')}`);

console.log('');
