import { GraphBuilder, type ProcessInterface } from '@camcima/finita';
import { createPrepaymentProcess } from './order/process/Prepayment.js';
import { createPostpaymentProcess } from './order/process/Postpayment.js';

const processes = new Map<string, ProcessInterface>();
const prepayment = createPrepaymentProcess();
const postpayment = createPostpaymentProcess();
processes.set(prepayment.getName(), prepayment);
processes.set(postpayment.getName(), postpayment);

const processName = process.argv[2] ?? 'prepayment';
const selectedProcess = processes.get(processName);

if (!selectedProcess) {
  console.error(`Process "${processName}" not found. Available: ${Array.from(processes.keys()).join(', ')}`);
  process.exit(1);
}

console.log(`Graph for process: ${selectedProcess.getName()}\n`);

const builder = new GraphBuilder();
builder.addStateCollection(selectedProcess);
const graph = builder.getGraph();

console.log('States:');
for (const node of graph.nodes) {
  console.log(`  - ${node.id}${node.label !== node.id ? ` (${node.label})` : ''}`);
}

console.log('\nTransitions:');
for (const edge of graph.edges) {
  console.log(`  ${edge.source} -> ${edge.target}  [${edge.label}]`);
}

// Output DOT format using built-in toDot()
console.log('\nDOT format (pipe to `dot -Tsvg` to render):');
console.log(builder.toDot());

// Output Mermaid format using built-in toMermaid()
console.log('\nMermaid format:');
console.log(builder.toMermaid());
