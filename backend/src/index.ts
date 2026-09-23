/**
 * OneHealth AI - API server.
 *
 * Wiring order matters here: config is validated first (so a bad .env fails
 * immediately with a readable message), then storage is prepared, then routes
 * are mounted, and finally a catch-all error handler guarantees that no
 * unhandled exception ever reaches the client as a stack trace.
 */
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env, printConfigBanner } from './config/env';
import { prisma } from './config/database';
import authRoutes from './routes/auth.routes';
import recordsRoutes from './routes/records.routes';
import usersRoutes from './routes/users.routes';
import consentRoutes from './routes/consent.routes';
import shareRoutes from './routes/share.routes';
import assistantRoutes from './routes/assistant.routes';
import remindersRoutes from './routes/reminders.routes';
import { StorageService } from './services/storage.service';
import { AiService } from './services/ai.service';
import { isRedisConnected } from './services/redis.service';

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    // The API serves stored PDFs/images inline to the SPA on another origin.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// --- Routes -----------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/consents', consentRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/reminders', remindersRoutes);

/** Simple liveness probe. */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Full system status, surfaced in the UI so the demo can show at a glance which
 * services are live and whether the AI is running with OCR / an LLM.
 */
app.get('/api/health', async (_req, res) => {
  const [database, ai] = await Promise.all([
    prisma
      .$queryRaw`SELECT 1`
      .then(() => ({ reachable: true }))
      .catch((error: any) => ({ reachable: false, error: error?.message })),
    AiService.health(),
  ]);

  const healthy = (database as any).reachable && ai.reachable;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      api: { reachable: true, version: '1.0.0' },
      database,
      aiService: ai,
      redis: { reachable: isRedisConnected(), fallback: 'in-memory' },
      storage: { driver: StorageService.driver },
    },
  });
});

// --- 404 --------------------------------------------------------------------
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    data: null,
    message: `No route matches ${req.method} ${req.path}`,
  });
});

// --- Catch-all error handler ------------------------------------------------
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[api] unhandled error:', err);
  res.status(err?.status || 500).json({
    success: false,
    data: null,
    // Never leak internals to the client, even in development, as per requirements.
    message: 'Service temporarily unavailable. Please try again.',
  });
});

// A rejected promise must not take the whole API down mid-demo.
process.on('unhandledRejection', (reason) => {
  console.error('[api] unhandled promise rejection:', reason);
});

async function start() {
  await StorageService.ensureReady();

  app.listen(env.PORT, () => {
    console.log('');
    console.log('  OneHealth AI - API server');
    console.log(`   Listening on   : http://localhost:${env.PORT}`);
    printConfigBanner();
    console.log('');
  });

  // Non-blocking: report AI availability once at boot so it is obvious in the log.
  AiService.health().then((health) => {
    if (health.reachable) {
      const capabilities = health.capabilities as any;
      console.log(
        `   AI service     : online (OCR ${capabilities?.ocrAvailable ? 'available' : 'unavailable'}, ` +
          `summaries ${capabilities?.llmConfigured ? 'via LLM' : 'deterministic'})`
      );
    } else {
      console.warn(`   AI service     : OFFLINE - ${health.error}`);
    }
    console.log('');
  });
}

start().catch((error) => {
  console.error('Failed to start the API server:', error);
  process.exit(1);
});
