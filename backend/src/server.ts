import { createApp } from "./app";
import { loadConfig } from "./config/env";

const config = loadConfig();
const app = createApp(config);

app.listen(config.port, () => {
  console.log(`API ready on http://localhost:${config.port} (search: ${config.searchProvider})`);
  if (config.searchProvider === "mock") {
    console.log('Demo catalogue in use (no audio). Remove SEARCH_PROVIDER=mock from .env to search iTunes.');
  }
});
