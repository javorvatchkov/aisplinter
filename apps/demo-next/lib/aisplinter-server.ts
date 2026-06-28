import { createAisplinterApp } from '@aisplinter/server';
import { createAisplinterSingleton } from '@aisplinter/server/next';

const AISPLINTER_BASE_PATH = '/api/aisplinter';

export const getAisplinterApp = createAisplinterSingleton(async () => {
  const { app } = await createAisplinterApp({
    basePath: AISPLINTER_BASE_PATH,
    setupWizard: true,
    logger: process.env.NODE_ENV !== 'production',
  });
  return app;
});

export { AISPLINTER_BASE_PATH };
