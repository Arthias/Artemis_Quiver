import { WEBLLM_MODELS } from "../services/provider/WebLLMAdapter";

export interface DeviceInfo {
  vendor: string;
  architecture: string;
  deviceMemory: number;
  vramEstimate: number;
  unreliable: boolean;
}

export interface WebLLMModelEntry {
  id: string;
  name: string;
  sizeGB: number;
  vramGB: number;
  descKey?: string;
}

function isIntegratedGPU(vendor: string, architecture: string): boolean {
  const integratedVendors = ["qualcomm", "arm", "apple"];
  const dedicatedVendors = ["nvidia", "amd"];
  const vendorLower = vendor.toLowerCase();
  const archLower = architecture.toLowerCase();

  if (integratedVendors.some(v => vendorLower.includes(v))) return true;
  if (dedicatedVendors.some(v => vendorLower.includes(v))) {
    return archLower.includes("integrated");
  }
  if (vendorLower.includes("intel")) {
    return !archLower.includes("discrete") && !archLower.includes("arc");
  }
  return true;
}

function getDedicatedVRAMHeuristic(vendor: string): number {
  const v = vendor.toLowerCase();
  if (v.includes("nvidia")) return 8;
  if (v.includes("amd")) return 8;
  return 6;
}

export async function estimateAvailableVRAM(): Promise<DeviceInfo> {
  const systemRAM = (navigator as any).deviceMemory ?? 8;
  let gpuInfo = { vendor: "unknown", architecture: "unknown" };

  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        const info = await (adapter as any).requestAdapterInfo();
        gpuInfo = { vendor: info.vendor ?? "unknown", architecture: info.architecture ?? "unknown" };
      }
    } catch {
      // GPU adapter unavailable — use heuristic
    }
  }

  const integrated = isIntegratedGPU(gpuInfo.vendor, gpuInfo.architecture);
  const vramEstimate = integrated
    ? systemRAM * 0.7
    : Math.min(systemRAM * 0.5, getDedicatedVRAMHeuristic(gpuInfo.vendor));

  return {
    ...gpuInfo,
    deviceMemory: systemRAM,
    vramEstimate,
    unreliable: !("deviceMemory" in navigator),
  };
}

export function recommendModel(deviceInfo: DeviceInfo, models: readonly WebLLMModelEntry[] = WEBLLM_MODELS as unknown as WebLLMModelEntry[]): WebLLMModelEntry {
  const safeVRAM = deviceInfo.vramEstimate * 0.8;
  let best = models[0]!;
  for (const m of models) {
    if (m.vramGB <= safeVRAM) best = m;
    else break;
  }
  return best;
}
