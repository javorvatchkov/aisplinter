import { getAisplinterApp } from '../../../lib/aisplinter-server';
import { createNextRouteHandlers } from '@aisplinter/server/next';

export const { GET, POST, PUT, PATCH, DELETE, OPTIONS } = createNextRouteHandlers(getAisplinterApp);
