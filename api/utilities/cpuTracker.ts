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
    },
    'cpu'
  );
}

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
