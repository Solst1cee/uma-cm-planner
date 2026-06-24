import EngineWorker from './engine.worker?worker';
import type { SimBuild, SimRaceParams, SimRequest, SimResponse, BashinStats, VacuumResult, VacuumOpts, SkillTrace, SkillImpact, RaceCompare } from './types';

type WorkerFactory = () => Worker;

/** Default factory uses Vite's ?worker import; tests inject a fake. */
function defaultFactory(): Worker {
  return new EngineWorker();
}

export class SimClient {
  private worker: Worker;
  private seq = 0;
  private pending = new Map<number, { resolve: (r: SimResponse) => void; reject: (e: Error) => void }>();

  constructor(factory: WorkerFactory = defaultFactory) {
    this.worker = factory();
    this.worker.onmessage = (e: MessageEvent<SimResponse>) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      this.pending.delete(e.data.id);
      p.resolve(e.data);
    };
    const failAll = (msg: string) => {
      for (const p of this.pending.values()) p.reject(new Error(msg));
      this.pending.clear();
    };
    this.worker.onerror = (e) => failAll(`sim worker error: ${(e as { message?: string }).message ?? 'worker crashed'}`);
    this.worker.onmessageerror = () => failAll('sim worker message could not be deserialized');
  }

  private send(req: SimRequest): Promise<SimResponse> {
    return new Promise((resolve, reject) => {
      this.pending.set(req.id, { resolve, reject });
      this.worker.postMessage(req);
    });
  }

  async skillDelta(build: SimBuild, race: SimRaceParams, skillId: string, nsamples: number, seed?: number): Promise<BashinStats> {
    const id = ++this.seq;
    const res = await this.send({ id, kind: 'skillDelta', build, race, skillId, nsamples, seed });
    if (!res.ok) throw new Error(res.error);
    if (res.kind !== 'skillDelta') throw new Error(`unexpected response kind: ${res.kind}`);
    return res.stats;
  }

  async vacuum(a: SimBuild, b: SimBuild, race: SimRaceParams, nsamples: number, seed?: number, opts?: VacuumOpts): Promise<VacuumResult> {
    const id = ++this.seq;
    const res = await this.send({ id, kind: 'vacuum', a, b, race, nsamples, seed, opts });
    if (!res.ok) throw new Error(res.error);
    if (res.kind !== 'vacuum') throw new Error(`unexpected response kind: ${res.kind}`);
    return res.stats;
  }

  async planner(build: SimBuild, race: SimRaceParams, candidateSkills: string[], nsamples: number, seed?: number): Promise<BashinStats> {
    const id = ++this.seq;
    const res = await this.send({ id, kind: 'planner', build, race, candidateSkills, nsamples, seed });
    if (!res.ok) throw new Error(res.error);
    if (res.kind !== 'planner') throw new Error(`unexpected response kind: ${res.kind}`);
    return res.stats;
  }

  async skillTrace(build: SimBuild, race: SimRaceParams, skillId: string, nsamples: number, seed?: number): Promise<SkillTrace> {
    const id = ++this.seq;
    const res = await this.send({ id, kind: 'skillTrace', build, race, skillId, nsamples, seed });
    if (!res.ok) throw new Error(res.error);
    if (res.kind !== 'skillTrace') throw new Error(`unexpected response kind: ${res.kind}`);
    return res.trace;
  }

  async skillImpact(build: SimBuild, race: SimRaceParams, skillId: string, nsamples: number, seed?: number): Promise<SkillImpact> {
    const id = ++this.seq;
    const res = await this.send({ id, kind: 'skillImpact', build, race, skillId, nsamples, seed });
    if (!res.ok) throw new Error(res.error);
    if (res.kind !== 'skillImpact') throw new Error(`unexpected response kind: ${res.kind}`);
    return res.impact;
  }

  async raceCompare(uma1: SimBuild, uma2: SimBuild, race: SimRaceParams, nsamples: number, seed?: number): Promise<RaceCompare> {
    const id = ++this.seq;
    const res = await this.send({ id, kind: 'raceCompare', uma1, uma2, race, nsamples, seed });
    if (!res.ok) throw new Error(res.error);
    if (res.kind !== 'raceCompare') throw new Error(`unexpected response kind: ${res.kind}`);
    return res.result;
  }

  dispose() { this.worker.terminate(); this.pending.clear(); }
}
