import { logger } from 'gadget-server';

// Gadget bills "active CPU time" but its dashboards can't say which code used it.
// These log lines (msg "cpu" / "boot") are collected by scripts/cpu-report.mjs.
// process.cpuUsage() is per process, so overlapping requests blur each other a bit.

const bootId = Math.random().toString(36).slice(2, 10);
let bootLogged = false;

const ms = (u: NodeJS.CpuUsage) => Math.round((u.user + u.system) / 1000);

// Call on the first request/action of a worker: CPU used so far = cost of starting it.
export function logBootOnce(trigger: string) {
  if (bootLogged) return;
  bootLogged = true;
  logger.info(
    {
      boot: true,
      at: new Date().toISOString(),
      bootId,
      trigger,
      bootCpuMs: ms(process.cpuUsage()),
      uptimeS: Math.round(process.uptime()),
      rssMb: Math.round(process.memoryUsage().rss / 1e6),
    },
    'boot'
  );
  // Workers burn ~3.7% CPU between requests once the first request has run. Profile that idle
  // window once per worker to see what is running. unref() so this never keeps a worker alive.
  profileState = 'scheduled';
  setTimeout(() => void runIdleProfile(), 120_000).unref();
}

type ProfileNode = { id: number; hitCount?: number; callFrame: { functionName: string; url: string; lineNumber: number } };

// "/gadget/app/node_modules/gaxios/build/src/x.js" -> "gaxios/build/src/x.js"; app files keep their path
function shortUrl(url: string) {
  if (!url) return '(native)';
  const i = url.lastIndexOf('node_modules/');
  if (i >= 0) return url.slice(i + 13);
  return url.replace(/^file:\/\//, '').replace(/^\/gadget\/app\//, '');
}

async function runIdleProfile(seconds = 30) {
  profileState = 'running';
  try {
    const inspector = await import('node:inspector');
    const { performance } = await import('node:perf_hooks');
    const session = new inspector.Session();
    session.connect();
    const post = (method: string, params?: object) =>
      new Promise<any>((resolve, reject) =>
        session.post(method, params, (err: Error | null, res: unknown) => (err ? reject(err) : resolve(res)))
      );

    const cpu0 = process.cpuUsage();
    const elu0 = performance.eventLoopUtilization();
    await post('Profiler.enable');
    await post('Profiler.setSamplingInterval', { interval: 1000 });
    await post('Profiler.start');
    await new Promise((r) => setTimeout(r, seconds * 1000));
    const { profile } = await post('Profiler.stop');
    session.disconnect();
    const cpu = process.cpuUsage(cpu0);
    const elu = performance.eventLoopUtilization(elu0);

    // Self time per function: samples that landed in it x sampling interval
    const intervalMs =
      profile.samples?.length > 0 ? (profile.endTime - profile.startTime) / 1000 / profile.samples.length : 1;
    const byFn: Record<string, number> = {};
    let sampledMs = 0;
    for (const n of profile.nodes as ProfileNode[]) {
      const hit = (n.hitCount ?? 0) * intervalMs;
      if (!hit) continue;
      const name = n.callFrame.functionName || '(anonymous)';
      if (name !== '(idle)' && name !== '(program)') sampledMs += hit;
      const key = `${name} ${shortUrl(n.callFrame.url)}:${n.callFrame.lineNumber + 1}`;
      byFn[key] = (byFn[key] ?? 0) + hit;
    }
    const top = Object.entries(byFn)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([fn, t]) => `${Math.round(t)}ms ${fn}`);

    const resources: Record<string, number> = {};
    for (const r of (process as any).getActiveResourcesInfo?.() ?? []) resources[r] = (resources[r] ?? 0) + 1;

    profileState = 'done';
    pendingProfile = {
        idleProfile: true,
        at: new Date().toISOString(),
        seconds,
        processCpuMs: ms(cpu), // all threads of the process
        userMs: Math.round(cpu.user / 1000),
        systemMs: Math.round(cpu.system / 1000),
        mainThreadSampledMs: Math.round(sampledMs), // far below processCpuMs = burn is in another thread
        eventLoopUtil: Number(elu.utilization.toFixed(4)),
        resources: JSON.stringify(resources),
        top: top.join(' | '),
        uptimeS: Math.round(process.uptime()),
    };
  } catch (err) {
    profileState = `failed: ${String(err).slice(0, 200)}`;
  }
}

export function startCpu() {
  return { cpu: process.cpuUsage(), wall: Date.now() };
}

export function logCpu(name: string, start: ReturnType<typeof startCpu>) {
  logger.info(
    {
      cpu: true,
      at: new Date().toISOString(),
      bootId,
      name,
      cpuMs: ms(process.cpuUsage(start.cpu)),
      wallMs: Date.now() - start.wall,
      // Whole-process CPU since this worker started (start-up + work + idle). The last value per
      // bootId is that worker's total, to compare with the dashboard's "Active CPU time".
      procCpuMs: ms(process.cpuUsage()),
      uptimeS: Math.round(process.uptime()),
      profileState,
    },
    'cpu'
  );
  // Gadget drops log lines written outside a request, so the idle profile is logged here
  if (pendingProfile) {
    logger.info({ ...pendingProfile, loggedAt: new Date().toISOString(), bootId }, 'idle-profile');
    pendingProfile = null;
  }
}

// 'none' -> 'scheduled' -> 'running' -> 'done' | 'failed: ...'; shows whether the timer fired at all
let profileState = 'none';
let pendingProfile: Record<string, unknown> | null = null;

// Wrap an action's run/onSuccess: withCpu('bankSync', async (ctx) => { ... })
export function withCpu<A extends unknown[], R>(name: string, fn: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R> => {
    logBootOnce(name);
    const start = startCpu();
    try {
      return await fn(...args);
    } finally {
      logCpu(name, start);
    }
  };
}
