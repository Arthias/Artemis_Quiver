import { config } from "../src/lib/config.ts";

async function testEnv() {
  console.log("Testing Environment Configuration...");
  
  const providers = config.providers;
  
  console.log("--- Providers ---");
  if (providers.lmstudio.baseUrl) {
    console.log(`LMStudio URL: ${providers.lmstudio.baseUrl}`);
  } else {
    console.error("LMStudio URL not found in config!");
  }

  if (providers.openrouter.apiKey) {
    console.log("OpenRouter key detected.");
  } else {
    console.warn("OpenRouter key is missing/empty.");
  }

  console.log("--- Connectivity Check ---");
  try {
    const response = await fetch(`${providers.lmstudio.baseUrl}`, { method: 'HEAD' });
    console.log(`LMStudio connection status: ${response.status} ${response.statusText}`);
  } catch (error) {
    console.error(`LMStudio connection failed: ${error.message}`);
  }

  console.log("--- Test Complete ---");
}

testEnv();



async function testEnv() {
  console.log("Testing Environment Configuration...");
  
  const providers = config.providers;
  
  console.log("--- Providers ---");
  if (providers.lmstudio.baseUrl) {
    console.log(`LMStudio URL: ${providers.lmstudio.baseUrl}`);
  } else {
    console.error("LMStudio URL not found in config!");
  }

  if (providers.openrouter.apiKey) {
    console.log("OpenRouter key detected.");
  } else {
    console.warn("OpenRouter key is missing/empty.");
  }

  console.log("--- Connectivity Check ---");
  try {
    // We won't actually call the API to avoid unnecessary traffic, 
    // but we check if the URL is valid and reachable via a simple fetch head request.
    const response = await fetch(`${providers.lmstudio.baseUrl}`, { method: 'HEAD' });
    console.log(`LMStudio connection status: ${response.status} ${response.statusText}`);
  } catch (error) {
    console.error(`LMStudio connection failed: ${error.message}`);
  }

  console.log("--- Test Complete ---");
}

testEnv();
