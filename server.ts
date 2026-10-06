import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '100mb' }));

// Health / Status endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', engine: 'ABIDES discrete-event simulator' });
});

// Endpoint to execute genuine ABIDES multi-agent discrete-event simulation
app.post('/api/run-simulation', async (req, res) => {
  const {
    seed = 42,
    endTime = '16:00:00',
    ticker = 'ABM',
    numEkf = 5,
    numMomEkf = 5,
    newsEvents = [],
  } = req.body;

  const simId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const tempDir = path.join('/tmp', `abides_run_${simId}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const pklOutput = path.join(tempDir, 'sim_data.pkl');
  const jsonOutput = path.join(tempDir, 'sim_data.json');

  const runnerPath = '/abides_repo/run_dashboard_sim.py';
  if (!fs.existsSync(runnerPath)) {
    console.log(`[ABIDES] Local runner not found at ${runnerPath}, signalling client-side simulation engine fallback`);
    return res.json({
      success: false,
      fallback: true,
      message: 'ABIDES Python runner not present in container environment; falling back to in-browser engine',
    });
  }

  const args = [
    runnerPath,
    '--seed', String(seed),
    '--end-time', String(endTime),
    '--ticker', String(ticker),
    '--num-ekf', String(numEkf),
    '--num-mom-ekf', String(numMomEkf),
    '--output', pklOutput,
  ];

  if (Array.isArray(newsEvents)) {
    for (const item of newsEvents) {
      if (Array.isArray(item) && item.length === 4) {
        // [offset, sym, sentiment, headline]
        args.push('--news', `${item[0]},${item[1]},${item[2]},${item[3]}`);
      }
    }
  }

  console.log(`[ABIDES] Launching simulation: python3 ${args.join(' ')}`);
  const child = spawn('python3', args, { cwd: '/abides_repo' });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (d) => {
    stdout += d.toString();
  });

  child.stderr.on('data', (d) => {
    stderr += d.toString();
  });

  child.on('close', (code) => {
    if (code !== 0) {
      console.error(`[ABIDES] Simulation exited with error code ${code}:\n${stderr}`);
      return res.status(500).json({
        error: `ABIDES simulation failed (exit code ${code})`,
        stdout,
        stderr,
      });
    }

    // Convert generated pickle to JSON using Python
    const converterScript = path.join(__dirname, 'scripts/pickle_to_json.py');
    const converter = spawn('python3', [converterScript, pklOutput, jsonOutput]);

    let convStderr = '';
    converter.stderr.on('data', (d) => {
      convStderr += d.toString();
    });

    converter.on('close', (cCode) => {
      if (cCode !== 0 || !fs.existsSync(jsonOutput)) {
        return res.status(500).json({
          error: 'Failed to convert simulation results to JSON',
          stderr: convStderr,
        });
      }

      try {
        const rawJson = fs.readFileSync(jsonOutput, 'utf-8');
        const simData = JSON.parse(rawJson);

        // Clean up temporary run files
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
          // ignore
        }

        console.log(`[ABIDES] Simulation successfully finished (${simData.book?.times_ns?.length} ticks, ${simData.trades?.length} trades)`);
        return res.json({
          success: true,
          stdout,
          data: simData,
        });
      } catch (err: any) {
        return res.status(500).json({ error: 'Failed to read simulation JSON output: ' + err.message });
      }
    });
  });
});

// Vite middleware in dev or static files in production
const isProduction = process.env.NODE_ENV === 'production';
if (!isProduction) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));
  app.use((_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ABIDES Dashboard] Full-Stack server running at http://0.0.0.0:${PORT}`);
});
