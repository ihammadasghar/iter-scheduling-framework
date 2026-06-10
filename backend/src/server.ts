import 'dotenv/config';
import { createApp } from './app.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const app = createApp();

app.listen(PORT, () => {
  console.log(`[server] Listening on port ${PORT} (${process.env['NODE_ENV'] ?? 'development'})`);
});
