import { EventEmitter } from 'events';

function makeState() {
  const ee = new EventEmitter();
  ee.setMaxListeners(200);
  return {
    ee,
    proc: null,
    status: 'idle',       // idle|scanning|done|stopped|error
    dups: [],             // accumulated duplicate groups
    events: [],           // replay buffer (max 5000)
    progress: { stage:'', n:0, done:0, total:0, dir:'' },
    scanPath: '',
    scanId: null,
    reportPath: null,
    startedAt: null,
    mode: 'scan',         // scan|single
    targetFile: '',
  };
}

if (!global.__DS) global.__DS = makeState();
export const S = global.__DS;

export function resetState() {
  const { ee } = S;
  S.proc=null; S.status='idle'; S.dups=[]; S.events=[];
  S.progress={stage:'',n:0,done:0,total:0,dir:''};
  S.scanPath=''; S.scanId=null; S.reportPath=null; S.startedAt=null;
  S.mode='scan'; S.targetFile='';
}

export function push(ev) {
  S.events.push(ev);
  if (S.events.length > 5000) S.events.shift();
  S.ee.emit('ev', ev);
}
