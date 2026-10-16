import "dotenv/config";
import app from "./app";
import { seedPredefinedPlans } from "./seed";

const port = Number(process.env.PORT) || 3000;

async function start() {
  try {
    await seedPredefinedPlans();

    app.listen(port, () => {
      console.log(`Server listening at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Service startup failed:", error);
    process.exit(1);
  }
}

void start();