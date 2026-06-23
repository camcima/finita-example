/**
 * Spotlight on features introduced/changed in finita v3 -> v4.
 *
 * Run with: `npm run features`
 *
 * The order-processing demo (`npm start`) already showcases ProcessBuilder,
 * typed observers, StatefulStatusChanger, TransitionLogger, frame.subject, and
 * automatic transitions. This file isolates the remaining headline features.
 */
import {
  ProcessBuilder,
  Statemachine,
  CallbackCondition,
  AndComposite,
  Tautology,
  Not,
  WeightTransition,
  OnEnterObserver,
  ReentrancyError,
  AutomaticTransitionCycleError,
} from '@camcima/finita';

function banner(title: string): void {
  console.log('\n' + '='.repeat(61));
  console.log(title);
  console.log('='.repeat(61));
}

const drain = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

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
// 2. ReentrancyError — re-entering the machine from an observer is rejected
// ---------------------------------------------------------------------------
banner('2. ReentrancyError — re-entrant triggerEvent from an observer');

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
  console.log(`  caught: ${(err as Error).message}`);
  console.log(`  instanceof ReentrancyError: ${err instanceof ReentrancyError}`);
  console.log(`  machine still usable, current state: ${sm2.getCurrentState().getName()}`);
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
// 4. WeightTransition — resolving ambiguous transitions deterministically
// ---------------------------------------------------------------------------
banner('4. WeightTransition — picking the highest-weight active transition');

const weightedProcess = new ProcessBuilder('weighted')
  .addState('start', { initial: true })
  .addState('low')
  .addState('high')
  // Both are active on "go"; the default selector would be ambiguous.
  .addTransition('start', 'low', { event: 'go', condition: always, weight: 1 })
  .addTransition('start', 'high', { event: 'go', condition: always, weight: 5 })
  .build();

const sm4 = new Statemachine({}, weightedProcess, {
  transitionSelector: new WeightTransition(),
});
await sm4.triggerEvent('go');
console.log(`  selected target (weight 5 wins): ${sm4.getCurrentState().getName()}`);

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
// The chained onEnter runs as its own queued operation; let the queue drain.
await drain();
console.log(`  after "submit", machine auto-advanced to: ${sm5.getCurrentState().getName()}`);

console.log('');
